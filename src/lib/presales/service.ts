import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  getTableColumns,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import Decimal from "decimal.js";
import type { Database } from "../db";
import {
  appointments,
  auditLogs,
  employeeProfiles,
  employeeRoleAssignments,
  leadActivities,
  leadFollowUps,
  leads,
  organizations,
  customers,
  projects,
  quotations,
  quotationItems,
  quotationDecisions,
  salesEngagements,
  presalesAttachments,
  orders,
  orderItems,
  workflowEvents,
  user,
  rolePermissions,
} from "../db/schema";
import { AccessError, orderPredicate, resolveAccess, type Access } from "../auth/access";
import { buildAuth, type AuthSettings } from "../auth/config";
import type { Permission } from "../auth/roles";
import { eligibleAssignments, leadScope } from "../leads/access";
import {
  appointmentSchema,
  quotationSchema,
  decisionSchema,
  engagementSchema,
  conversionSchema,
} from "./validation";
import { priceQuotation } from "./pricing";
import { initializeOrderStages } from "../orders/initialize";

export interface FileStore {
  upload(path: string, bytes: Uint8Array, type: string): Promise<void>;
  remove(path: string): Promise<void>;
  sign(path: string): Promise<string>;
}
export function presalesService(db: Database, settings: AuthSettings) {
  async function access(headers: Headers, tx = db) {
    return resolveAccess(tx, buildAuth(tx, settings), headers);
  }
  async function read(
    tx: Database,
    a: Access,
    id: string,
    permission: Permission = "leads.read",
    write = false,
  ) {
    const [lead] = await tx
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.id, z.uuid().parse(id)),
          leadScope(a, permission),
          write ? leadScope(a, "leads.write") : undefined,
        ),
      );
    if (!lead) throw new AccessError(404, "Lead unavailable");
    if (write && (lead.archivedAt || lead.outcome))
      throw new AccessError(409, "Closed or archived leads cannot receive workflow changes");
    return lead;
  }
  async function mutate<T>(
    headers: Headers,
    id: string,
    permission: Permission,
    work: (tx: Database, a: Access, lead: typeof leads.$inferSelect) => Promise<T>,
  ) {
    return db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;
      await tx.execute(sql`select pg_advisory_xact_lock(73190021)`);
      const a = await access(headers, tx),
        lead = await read(tx, a, id, permission, true);
      return work(tx, a, lead);
    });
  }
  async function log(
    tx: Database,
    a: Access,
    lead: typeof leads.$inferSelect,
    kind: string,
    summary: string,
    before: unknown = null,
    after: unknown = null,
  ) {
    await tx.insert(leadActivities).values({
      organizationId: lead.organizationId,
      leadId: lead.id,
      actorId: a.user.id,
      kind,
      summary,
      changes: { [kind]: { before, after } },
    });
    await tx.insert(auditLogs).values({
      organizationId: lead.organizationId,
      actorId: a.user.id,
      targetId: lead.id,
      action: `presales.${kind}`,
    });
    await tx
      .update(leads)
      .set({ version: sql`${leads.version}+1`, updatedAt: new Date() })
      .where(eq(leads.id, lead.id));
  }
  async function advance(tx: Database, a: Access, lead: typeof leads.$inferSelect, stage: number) {
    if (lead.stage === stage - 1) {
      await tx.update(leads).set({ stage }).where(eq(leads.id, lead.id));
      await tx.insert(workflowEvents).values({
        organizationId: lead.organizationId,
        leadId: lead.id,
        actorId: a.user.id,
        fromStage: lead.stage,
        toStage: stage,
        notes: "Pre-sales milestone recorded",
      });
    }
  }
  async function latest(tx: Database, leadId: string) {
    const [q] = await tx
      .select()
      .from(quotations)
      .where(eq(quotations.leadId, leadId))
      .orderBy(desc(quotations.revision))
      .limit(1);
    return q;
  }
  return {
    async list(headers: Headers, kind: "appointments" | "quotations", raw: unknown = {}) {
      const filter = z
          .object({
            q: z.string().trim().max(200).default(""),
            page: z.coerce.number().int().min(1).max(100000).default(1),
          })
          .parse(raw),
        a = await access(headers),
        permission = kind === "appointments" ? "appointments.manage" : "quotations.manage",
        search = filter.q ? `%${filter.q.replace(/[\\%_]/g, "\\$&")}%` : undefined;
      const where = and(
        leadScope(a, permission),
        leadScope(a, "leads.read"),
        search ? ilike(sql`coalesce(${leads.clientName},${customers.name})`, search) : undefined,
      );
      if (kind === "appointments") {
        const rows = await db
            .select({
              id: appointments.id,
              leadId: leads.id,
              client: sql<string>`coalesce(${leads.clientName},${customers.name})`,
              company: organizations.name,
              date: appointments.scheduledAt,
              status: appointments.status,
              employee: user.name,
            })
            .from(appointments)
            .innerJoin(leads, eq(appointments.leadId, leads.id))
            .innerJoin(customers, eq(leads.customerId, customers.id))
            .innerJoin(organizations, eq(leads.organizationId, organizations.id))
            .leftJoin(user, eq(appointments.assignedTo, user.id))
            .where(where)
            .orderBy(desc(appointments.scheduledAt), desc(appointments.id))
            .limit(20)
            .offset((filter.page - 1) * 20),
          [n] = await db
            .select({ total: count() })
            .from(appointments)
            .innerJoin(leads, eq(appointments.leadId, leads.id))
            .innerJoin(customers, eq(leads.customerId, customers.id))
            .where(where);
        return {
          rows: rows.map((r) => ({ ...r, reference: "Site visit", amount: null as string | null })),
          total: n.total,
          page: filter.page,
        };
      }
      const rows = await db
          .select({
            id: quotations.id,
            leadId: leads.id,
            client: sql<string>`coalesce(${leads.clientName},${customers.name})`,
            company: organizations.name,
            date: quotations.createdAt,
            revision: quotations.revision,
            amount: quotations.amount,
          })
          .from(quotations)
          .innerJoin(leads, eq(quotations.leadId, leads.id))
          .innerJoin(customers, eq(leads.customerId, customers.id))
          .innerJoin(organizations, eq(leads.organizationId, organizations.id))
          .where(where)
          .orderBy(desc(quotations.createdAt), desc(quotations.id))
          .limit(20)
          .offset((filter.page - 1) * 20),
        [n] = await db
          .select({ total: count() })
          .from(quotations)
          .innerJoin(leads, eq(quotations.leadId, leads.id))
          .innerJoin(customers, eq(leads.customerId, customers.id))
          .where(where);
      return {
        rows: rows.map((r) => ({
          ...r,
          reference: `Quotation V${r.revision}`,
          status: "Issued",
          employee: null as string | null,
        })),
        total: n.total,
        page: filter.page,
      };
    },
    async orderDetail(headers: Headers, id: string) {
      const a = await access(headers);
      for (const organizationId of new Set(
        eligibleAssignments(a, "orders.read").map((s) => s.organizationId),
      )) {
        const [order] = await db
          .select({
            ...getTableColumns(orders),
            client: customers.name,
            project: projects.name,
            company: organizations.name,
          })
          .from(orders)
          .innerJoin(customers, eq(orders.customerId, customers.id))
          .leftJoin(projects, eq(orders.projectId, projects.id))
          .innerJoin(organizations, eq(orders.organizationId, organizations.id))
          .where(
            and(
              eq(orders.id, z.uuid().parse(id)),
              orderPredicate(a, organizationId, "orders.read"),
            ),
          );
        if (!order) continue;
        const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id)),
          events = await db
            .select()
            .from(workflowEvents)
            .where(eq(workflowEvents.orderId, id))
            .orderBy(desc(workflowEvents.createdAt))
            .limit(100);
        return { order, items, events };
      }
      throw new AccessError(404, "Order unavailable");
    },
    async detail(headers: Headers, id: string, page = 1) {
      const a = await access(headers),
        lead = await read(db, a, id),
        offset = (z.number().int().min(1).max(100000).parse(page) - 1) * 20;
      const allowed = (p: Permission) =>
        eligibleAssignments(a, p).some(
          (s) =>
            s.organizationId === lead.organizationId &&
            (["Admin", "Super Admin"].includes(s.role) || s.centreId === lead.centreId),
        );
      const visits = allowed("appointments.manage")
        ? await db
            .select({ ...getTableColumns(appointments), assignedName: user.name })
            .from(appointments)
            .leftJoin(user, eq(appointments.assignedTo, user.id))
            .where(eq(appointments.leadId, id))
            .orderBy(desc(appointments.scheduledAt), desc(appointments.id))
            .limit(20)
            .offset(offset)
        : [];
      const quotes = allowed("quotations.manage")
        ? await db
            .select()
            .from(quotations)
            .where(eq(quotations.leadId, id))
            .orderBy(desc(quotations.revision))
            .limit(20)
            .offset(offset)
        : [];
      const quoteIds = quotes.map((q) => q.id),
        items = quoteIds.length
          ? await db
              .select()
              .from(quotationItems)
              .where(inArray(quotationItems.quotationId, quoteIds))
              .orderBy(asc(quotationItems.position), asc(quotationItems.id))
          : [],
        decisions = quoteIds.length
          ? await db
              .select({ ...getTableColumns(quotationDecisions), actorName: user.name })
              .from(quotationDecisions)
              .innerJoin(user, eq(quotationDecisions.actorId, user.id))
              .where(inArray(quotationDecisions.quotationId, quoteIds))
              .orderBy(desc(quotationDecisions.createdAt), desc(quotationDecisions.id))
          : [];
      const engagements = await db
        .select()
        .from(salesEngagements)
        .where(eq(salesEngagements.leadId, id))
        .orderBy(desc(salesEngagements.createdAt), desc(salesEngagements.id))
        .limit(20)
        .offset(offset);
      const files = await db
        .select({
          id: presalesAttachments.id,
          name: presalesAttachments.name,
          appointmentId: presalesAttachments.appointmentId,
          contentType: presalesAttachments.contentType,
          byteSize: presalesAttachments.byteSize,
          createdAt: presalesAttachments.createdAt,
        })
        .from(presalesAttachments)
        .where(eq(presalesAttachments.leadId, id))
        .orderBy(desc(presalesAttachments.createdAt), desc(presalesAttachments.id))
        .limit(20)
        .offset(offset);
      const [visitCount] = await db
          .select({ total: count() })
          .from(appointments)
          .where(eq(appointments.leadId, id)),
        [quoteCount] = await db
          .select({ total: count() })
          .from(quotations)
          .where(eq(quotations.leadId, id)),
        [engagementCount] = await db
          .select({ total: count() })
          .from(salesEngagements)
          .where(eq(salesEngagements.leadId, id)),
        [fileCount] = await db
          .select({ total: count() })
          .from(presalesAttachments)
          .where(eq(presalesAttachments.leadId, id));
      const [order] = allowed("orders.read")
        ? await db.select().from(orders).where(eq(orders.leadId, id))
        : [];
      return {
        visits,
        quotations: quotes.map((q) => ({
          ...q,
          items: items.filter((i) => i.quotationId === q.id),
          decisions: decisions.filter((d) => d.quotationId === q.id),
        })),
        engagements,
        files,
        page,
        hasMore:
          Math.max(
            allowed("appointments.manage") ? visitCount.total : 0,
            allowed("quotations.manage") ? quoteCount.total : 0,
            engagementCount.total,
            fileCount.total,
          ) >
          page * 20,
        canVisit: allowed("appointments.manage"),
        canQuote: allowed("quotations.manage"),
        canWrite: allowed("leads.write") && !lead.outcome && !lead.archivedAt,
        order: order ?? null,
      };
    },
    async appointment(headers: Headers, id: string, raw: unknown) {
      const data = appointmentSchema.parse(raw);
      return mutate(headers, id, "appointments.manage", async (tx, a, lead) => {
        if (data.status === "completed" && lead.stage < 2)
          throw new AccessError(400, "Schedule the site visit before recording its completion");
        const candidates = await tx
          .select({ role: employeeRoleAssignments.role })
          .from(employeeRoleAssignments)
          .innerJoin(employeeProfiles, eq(employeeRoleAssignments.userId, employeeProfiles.userId))
          .innerJoin(user, eq(user.id, employeeRoleAssignments.userId))
          .where(
            and(
              eq(employeeRoleAssignments.userId, data.assignedTo),
              eq(employeeRoleAssignments.organizationId, lead.organizationId),
              eq(employeeRoleAssignments.centreId, lead.centreId),
              eq(employeeProfiles.active, true),
              or(eq(user.banned, false), isNull(user.banned)),
            ),
          );
        const grants = await tx
          .select()
          .from(rolePermissions)
          .where(eq(rolePermissions.organizationId, lead.organizationId));
        if (
          !candidates.some(
            (c) =>
              ["Admin", "Super Admin", "Sales Manager", "Sales Executive", "CSE"].includes(
                c.role,
              ) &&
              (["Admin", "Super Admin"].includes(c.role) ||
                ["leads.read", "appointments.manage"].every((p) =>
                  grants.some((g) => g.role === c.role && g.permission === p),
                )),
          )
        )
          throw new AccessError(400, "Select an active sales employee in this branch");
        const [old] = data.id
          ? await tx
              .select()
              .from(appointments)
              .where(
                and(
                  eq(appointments.id, data.id),
                  eq(appointments.leadId, id),
                  eq(appointments.organizationId, lead.organizationId),
                ),
              )
          : [];
        if (data.id && (!old || old.version !== data.version))
          throw new AccessError(409, "Appointment changed or unavailable. Reload before saving.");
        if (old && ["completed", "cancelled", "no-show"].includes(old.status))
          throw new AccessError(409, "Historical visits are closed. Schedule a new appointment.");
        const values = {
          assignedTo: data.assignedTo,
          scheduledAt: new Date(data.scheduledAt),
          status: data.status,
          observations: data.observations,
          measurements: data.measurements,
          completedAt: data.status === "completed" ? new Date() : null,
          updatedAt: new Date(),
        };
        const [visit] = old
          ? await tx
              .update(appointments)
              .set({ ...values, version: old.version + 1 })
              .where(eq(appointments.id, old.id))
              .returning()
          : await tx
              .insert(appointments)
              .values({
                ...values,
                organizationId: lead.organizationId,
                leadId: id,
                kind: "site-visit",
              })
              .returning();
        if (data.nextFollowUp) {
          await tx.insert(leadFollowUps).values({
            organizationId: lead.organizationId,
            leadId: id,
            assignedTo: lead.assignedTo!,
            dueAt: new Date(data.nextFollowUp),
            action: data.nextAction,
            createdBy: a.user.id,
          });
          const [next] = await tx
            .select()
            .from(leadFollowUps)
            .where(and(eq(leadFollowUps.leadId, id), eq(leadFollowUps.state, "pending")))
            .orderBy(asc(leadFollowUps.dueAt))
            .limit(1);
          await tx
            .update(leads)
            .set({ nextFollowUp: next.dueAt, nextAction: next.action })
            .where(eq(leads.id, id));
        }
        await log(tx, a, lead, "site-visit", `Site visit ${data.status}`, old ?? null, visit);
        if (data.status === "completed" || ["scheduled", "confirmed"].includes(data.status))
          await advance(tx, a, lead, data.status === "completed" ? 3 : 2);
        return { id: visit.id };
      });
    },
    async quotation(headers: Headers, id: string, raw: unknown) {
      const data = quotationSchema.parse(raw);
      let pricing: ReturnType<typeof priceQuotation>;
      try {
        pricing = priceQuotation(data);
      } catch (error) {
        throw new AccessError(400, (error as Error).message);
      }
      return mutate(headers, id, "quotations.manage", async (tx, a, lead) => {
        const previous = await latest(tx, id);
        if ((previous?.revision ?? 0) !== data.expectedRevision)
          throw new AccessError(
            409,
            "A newer quotation exists. Reload before creating a revision.",
          );
        if (data.items.some((i) => i.productCompanyId !== lead.organizationId))
          throw new AccessError(
            400,
            "Item product company must match the lead company. Use a separate company enquiry for other products.",
          );
        const [company] = await tx
            .select()
            .from(organizations)
            .where(eq(organizations.id, lead.organizationId)),
          [customer] = await tx.select().from(customers).where(eq(customers.id, lead.customerId)),
          [project] = lead.projectId
            ? await tx.select().from(projects).where(eq(projects.id, lead.projectId))
            : [];
        const [q] = await tx
          .insert(quotations)
          .values({
            organizationId: lead.organizationId,
            leadId: id,
            revision: data.expectedRevision + 1,
            amount: pricing.amount,
            subtotal: pricing.subtotal,
            discount: pricing.discount,
            customerNotes: data.customerNotes,
            revisionReason: data.revisionReason,
            createdBy: a.user.id,
            snapshot: {
              company: company.name,
              client: lead.clientName ?? customer.name,
              mobile: lead.mobile ?? customer.mobile ?? "",
              project: project?.name ?? "",
              address: lead.siteAddress ?? project?.siteAddress ?? "",
            },
          })
          .returning();
        await tx.insert(quotationItems).values(
          pricing.items.map((i, position) => ({
            ...i,
            position,
            quotationId: q.id,
            organizationId: lead.organizationId,
          })),
        );
        await log(
          tx,
          a,
          lead,
          "quotation",
          `Quotation V${q.revision} issued${data.revisionReason ? `: ${data.revisionReason}` : ""}`,
          previous ? { id: previous.id, revision: previous.revision } : null,
          { id: q.id, amount: q.amount },
        );
        await advance(tx, a, lead, 4);
        return { id: q.id, revision: q.revision };
      });
    },
    async decide(headers: Headers, id: string, raw: unknown) {
      const data = decisionSchema.parse(raw);
      return mutate(headers, id, "quotations.manage", async (tx, a, lead) => {
        const q = await latest(tx, id);
        if (!q || q.id !== data.quotationId || !q.snapshot)
          throw new AccessError(409, "Only the latest complete quotation can receive a decision");
        await tx
          .insert(quotationDecisions)
          .values({ ...data, organizationId: lead.organizationId, actorId: a.user.id });
        await log(
          tx,
          a,
          lead,
          "quotation-decision",
          `Quotation V${q.revision} ${data.decision}: ${data.evidence}`,
          null,
          data,
        );
        return { id: q.id };
      });
    },
    async engagement(headers: Headers, id: string, raw: unknown) {
      const data = engagementSchema.parse(raw);
      return mutate(headers, id, "leads.write", async (tx, a, lead) => {
        const [record] = await tx
          .insert(salesEngagements)
          .values({
            ...data,
            occurredAt: new Date(data.occurredAt),
            organizationId: lead.organizationId,
            leadId: id,
            offeredValue: data.offeredValue || null,
            actorId: a.user.id,
          })
          .returning();
        await log(
          tx,
          a,
          lead,
          data.kind,
          `${data.kind === "showroom" ? "Showroom" : "Negotiation"}: ${data.notRequired ? `Not Required — ${data.reason}` : data.outcome}`,
          null,
          record,
        );
        await advance(tx, a, lead, data.kind === "showroom" ? 5 : 6);
        return { id: record.id };
      });
    },
    async quotationDetail(headers: Headers, id: string, quoteId: string) {
      const a = await access(headers);
      await read(db, a, id, "quotations.manage");
      const [q] = await db
        .select()
        .from(quotations)
        .where(and(eq(quotations.id, z.uuid().parse(quoteId)), eq(quotations.leadId, id)));
      if (!q) throw new AccessError(404, "Quotation unavailable");
      const items = await db
        .select()
        .from(quotationItems)
        .where(eq(quotationItems.quotationId, q.id))
        .orderBy(asc(quotationItems.position), asc(quotationItems.id));
      return { ...q, items };
    },
    async convert(headers: Headers, id: string, raw: unknown) {
      const data = conversionSchema.parse(raw);
      return db.transaction(async (transaction) => {
        const tx = transaction as unknown as Database;
        await tx.execute(sql`select pg_advisory_xact_lock(73190021)`);
        const a = await access(headers, tx),
          lead = await read(tx, a, id, "leads.write");
        const [existing] = await tx.select().from(orders).where(eq(orders.leadId, id));
        if (existing) {
          if (
            existing.quotationId === data.quotationId &&
            existing.organizationId === data.organizationId &&
            new Decimal(existing.finalValue ?? 0).eq(data.finalValue)
          )
            return { id: existing.id };
          throw new AccessError(409, "This lead already has an order");
        }
        if (lead.archivedAt || lead.outcome || lead.stage !== 6 || lead.version !== data.version)
          throw new AccessError(
            409,
            "Reload the open lead at Negotiation / Quotation Revision before converting",
          );
        if (data.organizationId !== lead.organizationId || !lead.projectId)
          throw new AccessError(400, "Confirm the lead company and linked project");
        const quote = await latest(tx, id);
        if (!quote || quote.id !== data.quotationId || !quote.snapshot)
          throw new AccessError(409, "Select the latest complete quotation");
        const [decision] = await tx
          .select()
          .from(quotationDecisions)
          .where(eq(quotationDecisions.quotationId, quote.id))
          .orderBy(desc(quotationDecisions.createdAt), desc(quotationDecisions.id))
          .limit(1);
        if (!decision || !["approved", "accepted"].includes(decision.decision))
          throw new AccessError(
            400,
            "An approved or accepted quotation with recorded evidence is required",
          );
        if (!new Decimal(data.finalValue).eq(quote.amount))
          throw new AccessError(
            400,
            "Final value must match the approved quotation. Create and approve a revision for a changed offer.",
          );
        const items = await tx
          .select()
          .from(quotationItems)
          .where(eq(quotationItems.quotationId, quote.id));
        if (!items.length) throw new AccessError(400, "Quotation items required");
        const finalQuantity = items.reduce((n, i) => n.plus(i.quantity), new Decimal(0)).toFixed(3);
        const [order] = await tx
          .insert(orders)
          .values({
            organizationId: lead.organizationId,
            leadId: id,
            customerId: lead.customerId,
            projectId: lead.projectId,
            centreId: lead.centreId,
            assignedTo: lead.assignedTo,
            quotationId: quote.id,
            finalValue: quote.amount,
            finalQuantity,
            stage: 1,
          })
          .returning();
        await tx.insert(orderItems).values(
          items.map((i) => ({
            organizationId: lead.organizationId,
            orderId: order.id,
            name: i.name,
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            amount: i.amount,
          })),
        );
        await tx
          .update(leads)
          .set({
            stage: 7,
            outcome: "won",
            finalisedValue: quote.amount,
            orderQty: new Decimal(finalQuantity).lt("1000000000") ? finalQuantity : null,
            closedAt: new Date(),
            nextFollowUp: null,
            nextAction: null,
          })
          .where(eq(leads.id, id));
        await tx
          .update(leadFollowUps)
          .set({ state: "cancelled", completedAt: new Date(), completionNotes: "Lead won" })
          .where(and(eq(leadFollowUps.leadId, id), eq(leadFollowUps.state, "pending")));
        await tx.insert(workflowEvents).values([
          {
            organizationId: lead.organizationId,
            leadId: id,
            actorId: a.user.id,
            fromStage: 6,
            toStage: 7,
            notes: `Won against quotation V${quote.revision}`,
          },
          {
            organizationId: lead.organizationId,
            orderId: order.id,
            actorId: a.user.id,
            fromStage: null,
            toStage: 1,
            notes: "Order created; WhatsApp Group Created is the first pending post-sales stage",
          },
        ]);
        await initializeOrderStages(tx, order, a.user.id);
        await log(
          tx,
          a,
          lead,
          "order-converted",
          `Order won against quotation V${quote.revision}`,
          null,
          { orderId: order.id, quotationId: quote.id, finalValue: quote.amount, finalQuantity },
        );
        return { id: order.id };
      });
    },
    async upload(
      headers: Headers,
      id: string,
      input: { name: string; contentType: string; bytes: Uint8Array; appointmentId?: string },
      store: FileStore,
    ) {
      const name = z.string().trim().min(1).max(180).parse(input.name),
        bytes = input.bytes;
      if (bytes.length === 0 || bytes.length > 4 * 1024 * 1024)
        throw new AccessError(400, "Files must be 1 byte to 4 MiB");
      const magic =
        input.contentType === "application/pdf"
          ? new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-"
          : input.contentType === "image/jpeg"
            ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
            : input.contentType === "image/png"
              ? Buffer.from(bytes.slice(0, 8)).equals(
                  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
                )
              : false;
      if (!magic) throw new AccessError(400, "Upload a valid PDF, JPEG or PNG");
      let uploadedPath: string | undefined;
      try {
        return await mutate(headers, id, "appointments.manage", async (tx, a, lead) => {
          if (input.appointmentId) {
            const [visit] = await tx
              .select({ id: appointments.id })
              .from(appointments)
              .where(
                and(
                  eq(appointments.id, z.uuid().parse(input.appointmentId)),
                  eq(appointments.leadId, id),
                  eq(appointments.organizationId, lead.organizationId),
                ),
              );
            if (!visit) throw new AccessError(404, "Appointment unavailable");
          }
          const objectPath = `${lead.organizationId}/presales/${id}/${crypto.randomUUID()}`;
          await store.upload(objectPath, bytes, input.contentType);
          uploadedPath = objectPath;
          const [file] = await tx
            .insert(presalesAttachments)
            .values({
              organizationId: lead.organizationId,
              leadId: id,
              appointmentId: input.appointmentId || null,
              name,
              objectPath,
              contentType: input.contentType,
              byteSize: bytes.length,
              uploadedBy: a.user.id,
            })
            .returning();
          await log(tx, a, lead, "attachment", `Visit attachment uploaded: ${name}`, null, {
            id: file.id,
            appointmentId: file.appointmentId,
          });
          return { id: file.id };
        });
      } catch (error) {
        if (uploadedPath) await store.remove(uploadedPath).catch(() => undefined);
        throw error;
      }
    },
    async download(headers: Headers, id: string, fileId: string, store: FileStore) {
      const a = await access(headers),
        lead = await read(db, a, id);
      const [file] = await db
        .select()
        .from(presalesAttachments)
        .where(
          and(
            eq(presalesAttachments.id, z.uuid().parse(fileId)),
            eq(presalesAttachments.leadId, id),
            eq(presalesAttachments.organizationId, lead.organizationId),
          ),
        );
      if (!file || !file.objectPath.startsWith(`${lead.organizationId}/presales/${id}/`))
        throw new AccessError(404, "Attachment unavailable");
      return { url: await store.sign(file.objectPath), expiresIn: 60 };
    },
  };
}
