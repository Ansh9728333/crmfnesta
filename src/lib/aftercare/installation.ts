import { and, eq } from "drizzle-orm";
import Decimal from "decimal.js";
import { z } from "zod";
import type { Database } from "../db";
import type { Access } from "../auth/access";
import * as s from "../db/schema";
import { aftercareActionSchema } from "./validation";
import { actual, assigned, fail, loadStatus, need, person, stale, type Order } from "./context";
type Input = z.infer<typeof aftercareActionSchema>;
export async function installationCommand(
  tx: Database,
  a: Access,
  o: Order & { companySlug: string },
  input: Input,
) {
  const base = { organizationId: o.organizationId, orderId: o.id };
  if (input.action === "installation.plan") {
    need(a, o, "orders.manage");
    const [l] = await tx
      .select()
      .from(s.productionLoads)
      .where(and(eq(s.productionLoads.id, input.loadId), eq(s.productionLoads.orderId, o.id)));
    if (!l || ["installed", "audit_passed", "completed"].includes(l.status))
      fail("Select an unfinished order load");
    const members = [...new Set([...input.teamMembers, input.assignedTo])];
    for (const id of members) await person(tx, o, id, "installations.manage");
    const [old] = await tx.select().from(s.installations).where(eq(s.installations.loadId, l.id));
    stale(old?.version ?? 0, input.version);
    const values = {
      assignedTo: input.assignedTo,
      teamName: input.teamName,
      teamMembers: members,
      plannedAt: new Date(input.plannedAt),
      remarks: input.remarks,
      version: (old?.version ?? 0) + 1,
      updatedAt: new Date(),
    };
    const [next] = old
      ? await tx
          .update(s.installations)
          .set(values)
          .where(eq(s.installations.id, old.id))
          .returning()
      : await tx
          .insert(s.installations)
          .values({ ...base, loadId: l.id, ...values })
          .returning();
    return { before: old, after: next };
  }
  if (!input.action.startsWith("installation.") && !input.action.startsWith("glass.")) return;
  const id = "installationId" in input ? input.installationId : "id" in input ? input.id : "";
  const [i] = await tx
    .select()
    .from(s.installations)
    .where(and(eq(s.installations.id, id), eq(s.installations.orderId, o.id)));
  if (!i?.loadId) fail("Installation unavailable");
  if (input.action === "installation.progress") {
    assigned(a, o, "installations.manage", [i.assignedTo, ...i.teamMembers]);
    const [retry] = await tx
      .select()
      .from(s.installationEntries)
      .where(eq(s.installationEntries.requestId, input.requestId));
    if (retry) {
      if (
        retry.installationId !== i.id ||
        retry.loadItemId !== input.loadItemId ||
        !new Decimal(retry.quantity).eq(input.quantity)
      )
        fail("Request already used for different progress");
      return { before: retry, after: retry, retry: true };
    }
  }
  if (!("version" in input)) fail("Version required");
  const [g] = await tx
    .select()
    .from(s.sgripGlassChecklists)
    .where(eq(s.sgripGlassChecklists.installationId, i.id));
  if (input.action.startsWith("glass.")) {
    if (o.companySlug !== "s-grip" || !g?.glassRequired || i.status !== "in_progress")
      fail("Glass checklist is available only for S-Grip installations requiring glass");
    stale(g.version, input.version);
    if (g.templateApproved) fail("Approved glass evidence is immutable");
    if (input.action === "glass.approve") need(a, o, "audits.manage");
    else assigned(a, o, "installations.manage", [i.assignedTo, ...i.teamMembers]);
    let values: Partial<typeof s.sgripGlassChecklists.$inferInsert> = {
      version: g.version + 1,
      updatedAt: new Date(),
      notes: "notes" in input ? input.notes : "",
    };
    if (input.action === "glass.measure") {
      if (g.templatePrepared) fail("Prepared measurements are immutable");
      await person(tx, o, input.responsibleId, "installations.manage");
      values = {
        ...values,
        measurementTaken: true,
        dimensions: input.dimensions,
        responsibleId: input.responsibleId,
        measuredAt: actual(input.occurredAt, i.startedAt),
      };
    }
    if (input.action === "glass.prepare") {
      if (!g.measurementTaken) fail("Record glass dimensions first");
      const [f] = await tx
        .select()
        .from(s.aftercareFiles)
        .where(
          and(
            eq(s.aftercareFiles.id, input.templateFileId),
            eq(s.aftercareFiles.installationId, i.id),
            eq(s.aftercareFiles.kind, "glass_template"),
          ),
        );
      if (!f) fail("Upload a glass template to this installation");
      values = {
        ...values,
        templatePrepared: true,
        templateFileId: f.id,
        preparedBy: a.user.id,
        preparedAt: actual(input.occurredAt, g.measuredAt),
      };
    }
    if (input.action === "glass.approve") {
      if (!g.templatePrepared || !g.templateFileId)
        fail("Prepare and upload the glass template first");
      values = {
        ...values,
        templateApproved: true,
        approvedBy: a.user.id,
        approvedAt: actual(input.occurredAt, g.preparedAt),
      };
    }
    const [next] = await tx
      .update(s.sgripGlassChecklists)
      .set(values)
      .where(eq(s.sgripGlassChecklists.id, g.id))
      .returning();
    return { before: g, after: next };
  }
  stale(i.version, input.version);
  assigned(a, o, "installations.manage", [i.assignedTo, ...i.teamMembers]);
  if (input.action === "installation.start") {
    const [l] = await tx.select().from(s.productionLoads).where(eq(s.productionLoads.id, i.loadId));
    if (i.status !== "planned" || l.status !== "delivered")
      fail("Confirmed full material delivery is required before installation");
    if (o.companySlug === "s-grip" && input.glassRequired === undefined)
      fail("Choose Glass Required: Yes or No");
    const at = actual(
      input.occurredAt,
      typeof l.data.deliveredAt === "string" ? new Date(l.data.deliveredAt) : null,
    );
    if (o.companySlug === "s-grip")
      await tx.insert(s.sgripGlassChecklists).values({
        organizationId: o.organizationId,
        installationId: i.id,
        glassRequired: input.glassRequired!,
      });
    const [next] = await tx
      .update(s.installations)
      .set({ status: "in_progress", startedAt: at, version: i.version + 1, updatedAt: new Date() })
      .where(eq(s.installations.id, i.id))
      .returning();
    await loadStatus(tx, a, o, i.loadId, "installation_started", at);
    return { before: i, after: next };
  }
  if (i.status !== "in_progress") fail("Installation must be in progress");
  if (input.action === "installation.progress") {
    const [line] = await tx
      .select()
      .from(s.productionLoadItems)
      .where(
        and(
          eq(s.productionLoadItems.id, input.loadItemId),
          eq(s.productionLoadItems.loadId, i.loadId),
        ),
      );
    if (!line || new Decimal(line.installedQuantity).plus(input.quantity).gt(line.quantity))
      fail("Installed quantity exceeds the load item balance");
    const [next] = await tx
      .insert(s.installationEntries)
      .values({
        ...base,
        installationId: i.id,
        loadItemId: line.id,
        quantity: input.quantity,
        occurredAt: actual(input.occurredAt, i.startedAt),
        recordedBy: a.user.id,
        remarks: input.notes,
        requestId: input.requestId,
      })
      .returning();
    await tx
      .update(s.installations)
      .set({ version: i.version + 1, updatedAt: new Date() })
      .where(eq(s.installations.id, i.id));
    return { before: line, after: next };
  }
  if (input.action === "installation.complete") {
    const lines = await tx
      .select()
      .from(s.productionLoadItems)
      .where(eq(s.productionLoadItems.loadId, i.loadId));
    if (!lines.length || lines.some((l) => !new Decimal(l.installedQuantity).eq(l.quantity)))
      fail("Install all load quantities first");
    if (o.companySlug === "s-grip" && (!g || (g.glassRequired && !g.templateApproved)))
      fail("Complete the S-Grip glass checklist first");
    const [photo] = await tx
      .select()
      .from(s.aftercareFiles)
      .where(
        and(
          eq(s.aftercareFiles.installationId, i.id),
          eq(s.aftercareFiles.kind, "installation_photo"),
        ),
      );
    if (!photo) fail("Upload installation photos first");
    const entries = await tx
      .select()
      .from(s.installationEntries)
      .where(eq(s.installationEntries.installationId, i.id));
    const at = actual(
      input.occurredAt,
      new Date(
        Math.max(
          i.startedAt!.getTime(),
          g?.approvedAt?.getTime() ?? 0,
          ...entries.map((e) => e.occurredAt.getTime()),
        ),
      ),
    );
    const [next] = await tx
      .update(s.installations)
      .set({
        status: "completed",
        completedAt: at,
        completedBy: a.user.id,
        remarks: input.notes,
        version: i.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(s.installations.id, i.id))
      .returning();
    await loadStatus(tx, a, o, i.loadId, "installed", at);
    return { before: i, after: next };
  }
}
