import { and, asc, count, desc, eq, getTableColumns, ilike, lt, or } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db";
import type { AuthSettings } from "../auth/config";
import { AccessError } from "../auth/access";

import type { FileStore } from "../presales/service";
import * as s from "../db/schema";
import { context, event, can, people, fail, need, assigned, featureScope } from "./context";
import { installationCommand } from "./installation";
import { auditCommand } from "./audit";
import { closureCommand } from "./closure";
import { aftercareActionSchema, aftercareFilters, aftercareFileKinds } from "./validation";
export function aftercareService(db: Database, settings: AuthSettings) {
  const c = context(db, settings);
  return {
    async list(h: Headers, raw: unknown, mode: "installations" | "service" = "installations") {
      const a = await c.access(h),
        f = aftercareFilters.parse(raw),
        conditions = and(
          c.scope(a),
          eq(s.leads.outcome, "won"),
          f.organizationId ? eq(s.orders.organizationId, f.organizationId) : undefined,
          f.q ? ilike(s.customers.name, `%${f.q}%`) : undefined,
          featureScope(a),
        );
      if (mode === "service") {
        const where = and(
          conditions,
          f.status ? eq(s.serviceTickets.status, f.status) : undefined,
          f.priority ? eq(s.serviceTickets.priority, f.priority) : undefined,
          f.overdue === "yes"
            ? and(
                lt(s.serviceTickets.dueAt, new Date()),
                or(
                  eq(s.serviceTickets.status, "open"),
                  eq(s.serviceTickets.status, "in_progress"),
                  eq(s.serviceTickets.status, "waiting_customer"),
                ),
              )
            : undefined,
        );
        const query = () =>
          db
            .select({
              ...getTableColumns(s.serviceTickets),
              client: s.customers.name,
              company: s.organizations.name,
            })
            .from(s.serviceTickets)
            .innerJoin(s.orders, eq(s.serviceTickets.orderId, s.orders.id))
            .innerJoin(s.leads, eq(s.leads.id, s.orders.leadId))
            .innerJoin(s.customers, eq(s.orders.customerId, s.customers.id))
            .innerJoin(s.organizations, eq(s.orders.organizationId, s.organizations.id))
            .where(where);
        const rows = await query()
          .orderBy(asc(s.serviceTickets.dueAt), desc(s.serviceTickets.id))
          .limit(20)
          .offset((f.page - 1) * 20);
        const [{ total }] = await db
          .select({ total: count() })
          .from(s.serviceTickets)
          .innerJoin(s.orders, eq(s.serviceTickets.orderId, s.orders.id))
          .innerJoin(s.leads, eq(s.leads.id, s.orders.leadId))
          .innerJoin(s.customers, eq(s.orders.customerId, s.customers.id))
          .where(where);
        return { rows, total, page: f.page };
      }
      const rows = await db
        .select({
          id: s.orders.id,
          client: s.customers.name,
          company: s.organizations.name,
          stage: s.orders.stage,
        })
        .from(s.orders)
        .innerJoin(s.leads, eq(s.leads.id, s.orders.leadId))
        .innerJoin(s.customers, eq(s.orders.customerId, s.customers.id))
        .innerJoin(s.organizations, eq(s.orders.organizationId, s.organizations.id))
        .where(conditions)
        .orderBy(desc(s.orders.createdAt), desc(s.orders.id))
        .limit(20)
        .offset((f.page - 1) * 20);
      const [{ total }] = await db
        .select({ total: count() })
        .from(s.orders)
        .innerJoin(s.leads, eq(s.leads.id, s.orders.leadId))
        .innerJoin(s.customers, eq(s.orders.customerId, s.customers.id))
        .where(conditions);
      return { rows, total, page: f.page };
    },
    async detail(h: Headers, id: string, page = 1) {
      const a = await c.access(h),
        order = await c.read(db, a, id);
      const where = eq(s.aftercareEvents.orderId, id),
        historyPage = z.number().int().min(1).max(100000).parse(page);
      const loads = await db
        .select()
        .from(s.productionLoads)
        .where(eq(s.productionLoads.orderId, id))
        .orderBy(asc(s.productionLoads.loadNumber));
      const items = await db
        .select({ ...getTableColumns(s.productionLoadItems), name: s.orderItems.name })
        .from(s.productionLoadItems)
        .innerJoin(s.productionLoads, eq(s.productionLoads.id, s.productionLoadItems.loadId))
        .innerJoin(s.orderItems, eq(s.orderItems.id, s.productionLoadItems.orderItemId))
        .where(eq(s.productionLoads.orderId, id));
      const installations = await db
          .select()
          .from(s.installations)
          .where(eq(s.installations.orderId, id)),
        audits = await db.select().from(s.engineerAudits).where(eq(s.engineerAudits.orderId, id));
      const glass = await db
        .select(getTableColumns(s.sgripGlassChecklists))
        .from(s.sgripGlassChecklists)
        .innerJoin(s.installations, eq(s.installations.id, s.sgripGlassChecklists.installationId))
        .where(eq(s.installations.orderId, id));
      const punches = await db
          .select()
          .from(s.auditPunchItems)
          .where(eq(s.auditPunchItems.orderId, id)),
        [handover] = await db.select().from(s.handovers).where(eq(s.handovers.orderId, id)),
        [feedback] = await db
          .select()
          .from(s.customerFeedback)
          .where(eq(s.customerFeedback.orderId, id));
      const tickets = await db
        .select()
        .from(s.serviceTickets)
        .where(eq(s.serviceTickets.orderId, id))
        .orderBy(desc(s.serviceTickets.createdAt));
      const files = await db
        .select({
          id: s.aftercareFiles.id,
          kind: s.aftercareFiles.kind,
          name: s.aftercareFiles.name,
          installationId: s.aftercareFiles.installationId,
          auditId: s.aftercareFiles.auditId,
          handoverId: s.aftercareFiles.handoverId,
          ticketId: s.aftercareFiles.ticketId,
          createdAt: s.aftercareFiles.createdAt,
        })
        .from(s.aftercareFiles)
        .where(eq(s.aftercareFiles.orderId, id));
      const events = await db
          .select()
          .from(s.aftercareEvents)
          .where(where)
          .orderBy(desc(s.aftercareEvents.createdAt), desc(s.aftercareEvents.id))
          .limit(20)
          .offset((historyPage - 1) * 20),
        [{ total }] = await db.select({ total: count() }).from(s.aftercareEvents).where(where);
      return {
        order,
        loads,
        items,
        installations,
        audits,
        glass,
        punches,
        handover: handover ?? null,
        feedback: feedback ?? null,
        tickets,
        files,
        events,
        historyPage,
        historyTotal: total,
        employees: await people(db, order),
        currentUserId: a.user.id,
        permissions: {
          coordinate: can(a, order, "orders.manage"),
          install: can(a, order, "installations.manage"),
          audit: can(a, order, "audits.manage"),
          service: can(a, order, "service.manage"),
          closeLoad: can(a, order, "production.manage"),
        },
      };
    },
    async change(h: Headers, id: string, raw: unknown) {
      const input = aftercareActionSchema.parse(raw);
      return c.transaction(h, id, async (tx, a, o) => {
        const [handover] = await tx.select().from(s.handovers).where(eq(s.handovers.orderId, id));
        if (
          (handover?.status === "confirmed" || o.completedAt) &&
          input.action !== "feedback.save" &&
          !input.action.startsWith("ticket.")
        )
          throw new AccessError(409, "Fulfillment is locked after handover");
        const result =
          (await installationCommand(tx, a, o, input)) ??
          (await auditCommand(tx, a, o, input)) ??
          (await closureCommand(tx, a, o, input));
        if (!result) fail("Unsupported action");
        if (!("retry" in result && result.retry))
          await event(
            tx,
            a,
            o,
            result.after.id,
            input.action,
            "notes" in input
              ? input.notes
              : "remarks" in input
                ? input.remarks
                : "comments" in input
                  ? input.comments
                  : "Recorded",
            result.before,
            result.after,
          );
        return { id: result.after.id };
      });
    },
    async upload(
      h: Headers,
      id: string,
      kindRaw: string,
      target: string,
      input: { name: string; contentType: string; bytes: Uint8Array },
      store: FileStore,
    ) {
      const kind = z.enum(aftercareFileKinds).parse(kindRaw);
      z.uuid().parse(target);
      const name = z.string().trim().min(1).max(180).parse(input.name),
        bytes = input.bytes;
      const valid =
        input.contentType === "application/pdf"
          ? Buffer.from(bytes.slice(0, 5)).toString() === "%PDF-"
          : input.contentType === "image/png"
            ? Buffer.from(bytes.slice(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : input.contentType === "image/jpeg" &&
              bytes[0] === 255 &&
              bytes[1] === 216 &&
              bytes[2] === 255;
      if (
        !valid ||
        !bytes.length ||
        bytes.length > 4194304 ||
        (kind.endsWith("_photo") && input.contentType === "application/pdf")
      )
        fail("Upload a valid JPEG/PNG photo or PDF document, at most 4 MiB");
      let uploaded: string | undefined;
      try {
        return await c.transaction(h, id, async (tx, a, o) => {
          let column: "installationId" | "auditId" | "handoverId" | "ticketId";
          if (kind === "installation_photo" || kind === "glass_template") {
            column = "installationId";
            const [i] = await tx
              .select()
              .from(s.installations)
              .where(and(eq(s.installations.id, target), eq(s.installations.orderId, id)));
            if (!i || i.status !== "in_progress") fail("Upload evidence during installation");
            assigned(a, o, "installations.manage", [i.assignedTo, ...i.teamMembers]);
            if (kind === "glass_template") {
              const [g] = await tx
                .select()
                .from(s.sgripGlassChecklists)
                .where(eq(s.sgripGlassChecklists.installationId, i.id));
              if (!g?.glassRequired || g.templateApproved)
                fail("Glass evidence is unavailable or locked");
            }
          } else if (kind === "audit_photo") {
            column = "auditId";
            const [r] = await tx
              .select()
              .from(s.engineerAudits)
              .where(and(eq(s.engineerAudits.id, target), eq(s.engineerAudits.orderId, id)));
            if (!r || ["approved", "submitted"].includes(r.status))
              fail("Audit evidence is locked");
            assigned(a, o, "audits.manage", [r.engineerId]);
          } else if (kind === "ticket_photo") {
            column = "ticketId";
            const [r] = await tx
              .select()
              .from(s.serviceTickets)
              .where(and(eq(s.serviceTickets.id, target), eq(s.serviceTickets.orderId, id)));
            if (!r || r.status === "closed") fail("Ticket unavailable or closed");
            need(a, o, "service.manage");
            if (!can(a, o, "orders.manage")) assigned(a, o, "service.manage", [r.assignedTo]);
          } else {
            column = "handoverId";
            need(a, o, "orders.manage");
            const [r] = await tx
              .select()
              .from(s.handovers)
              .where(and(eq(s.handovers.id, target), eq(s.handovers.orderId, id)));
            if (!r || r.status !== "draft") fail("Handover evidence is locked");
          }
          const path = `${o.organizationId}/${id}/aftercare/${kind}/${target}/${crypto.randomUUID()}`;
          await store.upload(path, bytes, input.contentType);
          uploaded = path;
          const [file] = await tx
            .insert(s.aftercareFiles)
            .values({
              organizationId: o.organizationId,
              orderId: id,
              [column]: target,
              kind,
              uploadedBy: a.user.id,
              name,
              objectPath: path,
              contentType: input.contentType,
              byteSize: bytes.length,
            })
            .returning();
          await event(tx, a, o, target, "file.uploaded", name, null, { id: file.id, kind, name });
          return { id: file.id };
        });
      } catch (error) {
        if (uploaded) await store.remove(uploaded).catch(() => undefined);
        throw error;
      }
    },
    async download(h: Headers, id: string, fileId: string, store: FileStore) {
      const a = await c.access(h);
      await c.read(db, a, id);
      const [f] = await db
        .select()
        .from(s.aftercareFiles)
        .where(
          and(eq(s.aftercareFiles.id, z.uuid().parse(fileId)), eq(s.aftercareFiles.orderId, id)),
        );
      if (!f) throw new AccessError(404);
      return { url: await store.sign(f.objectPath), expiresIn: 60 };
    },
  };
}
