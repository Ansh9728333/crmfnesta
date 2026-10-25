import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db";
import type { Access } from "../auth/access";
import * as s from "../db/schema";
import { aftercareActionSchema, auditChecks } from "./validation";
import { actual, assigned, fail, loadStatus, need, person, stale, type Order } from "./context";
import { assertInstalled } from "./gates";
type Input = z.infer<typeof aftercareActionSchema>;
export async function auditCommand(tx: Database, a: Access, o: Order, input: Input) {
  if (input.action === "load.complete") {
    if (
      !a.assignments.some(
        (r) => ["Admin", "Super Admin"].includes(r.role) && r.organizationId === o.organizationId,
      )
    )
      need(a, o, "production.manage");
    const [l] = await tx
      .select()
      .from(s.productionLoads)
      .where(and(eq(s.productionLoads.id, input.loadId), eq(s.productionLoads.orderId, o.id)));
    if (!l || l.status !== "audit_passed") fail("Approved load audit required");
    stale(l.version, input.version);
    const [i] = await tx.select().from(s.installations).where(eq(s.installations.loadId, l.id));
    if (!i) fail("Installation required");
    await assertInstalled(tx, i.id);
    const [audit] = await tx
      .select()
      .from(s.engineerAudits)
      .where(eq(s.engineerAudits.installationId, i.id));
    if (audit?.status !== "approved") fail("Approved audit required");
    await loadStatus(tx, a, o, l.id, "completed", actual(input.occurredAt, audit.inspectionAt));
    const [next] = await tx.select().from(s.productionLoads).where(eq(s.productionLoads.id, l.id));
    return { before: l, after: next };
  }
  if (input.action === "audit.plan") {
    need(a, o, "orders.manage");
    const [i] = await tx
      .select()
      .from(s.installations)
      .where(and(eq(s.installations.id, input.installationId), eq(s.installations.orderId, o.id)));
    if (!i) fail("Installation unavailable");
    await person(tx, o, input.engineerId, "audits.manage");
    const [old] = await tx
      .select()
      .from(s.engineerAudits)
      .where(eq(s.engineerAudits.installationId, i.id));
    stale(old?.version ?? 0, input.version);
    if (old && !["planned", "changes_required"].includes(old.status))
      fail("Submitted audit assignments are locked");
    const values = {
      engineerId: input.engineerId,
      plannedAt: new Date(input.plannedAt),
      notes: input.notes,
      version: (old?.version ?? 0) + 1,
      updatedAt: new Date(),
    };
    const [next] = old
      ? await tx
          .update(s.engineerAudits)
          .set(values)
          .where(eq(s.engineerAudits.id, old.id))
          .returning()
      : await tx
          .insert(s.engineerAudits)
          .values({
            organizationId: o.organizationId,
            orderId: o.id,
            installationId: i.id,
            ...values,
          })
          .returning();
    return { before: old, after: next };
  }
  if (input.action === "punch.resolve") {
    const [p] = await tx
      .select()
      .from(s.auditPunchItems)
      .where(and(eq(s.auditPunchItems.id, input.id), eq(s.auditPunchItems.orderId, o.id)));
    if (!p) fail("Punch item unavailable");
    stale(p.version, input.version);
    const [audit] = await tx
      .select()
      .from(s.engineerAudits)
      .where(eq(s.engineerAudits.id, p.auditId));
    if (p.status !== "open" || audit.status === "approved") fail("Punch item is locked");
    if (a.user.id === audit.engineerId) assigned(a, o, "audits.manage", [audit.engineerId]);
    else assigned(a, o, "installations.manage", [p.assignedTo]);
    const [next] = await tx
      .update(s.auditPunchItems)
      .set({
        status: "resolved",
        resolution: input.notes,
        resolvedAt: actual(input.occurredAt, audit.inspectionAt),
        resolvedBy: a.user.id,
        version: p.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(s.auditPunchItems.id, p.id))
      .returning();
    return { before: p, after: next };
  }
  if (!input.action.startsWith("audit.") && input.action !== "punch.create") return;
  const id = input.action === "punch.create" ? input.auditId : "id" in input ? input.id : "";
  const [audit] = await tx
    .select()
    .from(s.engineerAudits)
    .where(and(eq(s.engineerAudits.id, id), eq(s.engineerAudits.orderId, o.id)));
  if (!audit?.installationId) fail("Audit unavailable");
  assigned(a, o, "audits.manage", [audit.engineerId]);
  if (audit.status === "approved") fail("Approved audits are immutable");
  if (input.action === "punch.create") {
    if (audit.status === "submitted") fail("Request audit changes before adding punch items");
    await person(tx, o, input.assignedTo, "installations.manage");
    const [next] = await tx
      .insert(s.auditPunchItems)
      .values({
        organizationId: o.organizationId,
        orderId: o.id,
        auditId: audit.id,
        description: input.description,
        assignedTo: input.assignedTo,
        dueAt: new Date(input.dueAt),
      })
      .returning();
    return { before: null, after: next };
  }
  if (!("version" in input)) fail("Version required");
  stale(audit.version, input.version);
  const i = await assertInstalled(tx, audit.installationId);
  let values: Partial<typeof s.engineerAudits.$inferInsert> = {
    version: audit.version + 1,
    updatedAt: new Date(),
    notes: "notes" in input ? input.notes : "",
  };
  if (input.action === "audit.inspect") {
    if (audit.status === "submitted") fail("Submitted inspection is locked");
    values = {
      ...values,
      status: "in_progress",
      inspectionAt: actual(input.inspectionAt, i.completedAt),
      checklist: input.checklist,
    };
  } else if (input.action === "audit.changes") {
    if (audit.status !== "submitted") fail("Only submitted audits can be returned");
    values = { ...values, status: "changes_required" };
  } else {
    if (
      input.action === "audit.submit" &&
      !["in_progress", "changes_required"].includes(audit.status)
    )
      fail("Record an inspection first");
    if (input.action === "audit.approve" && audit.status !== "submitted")
      fail("Submit the audit first");
    if (
      !audit.inspectionAt ||
      auditChecks.some(
        (key) =>
          !audit.checklist.some(
            (c) =>
              c.key === key &&
              (c.result === "pass" || (c.result === "not_applicable" && c.notes.trim())),
          ),
      )
    )
      fail("All audit checks must pass or include a Not Applicable reason");
    const punches = await tx
      .select()
      .from(s.auditPunchItems)
      .where(eq(s.auditPunchItems.auditId, audit.id));
    if (punches.some((p) => p.status !== "resolved"))
      fail("Resolve every punch item before approval");
    const [photo] = await tx
      .select()
      .from(s.aftercareFiles)
      .where(and(eq(s.aftercareFiles.auditId, audit.id), eq(s.aftercareFiles.kind, "audit_photo")));
    if (!photo) fail("Upload audit site photos");
    values = {
      ...values,
      status: input.action === "audit.approve" ? "approved" : "submitted",
      ...(input.action === "audit.approve"
        ? { approvedBy: a.user.id, completedAt: new Date() }
        : {}),
    };
  }
  const [next] = await tx
    .update(s.engineerAudits)
    .set(values)
    .where(eq(s.engineerAudits.id, audit.id))
    .returning();
  if (next.status === "approved")
    await loadStatus(tx, a, o, i.loadId!, "audit_passed", audit.inspectionAt!);
  return { before: audit, after: next };
}
