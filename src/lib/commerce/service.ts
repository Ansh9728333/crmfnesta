import { adminCatalog } from "../db/schema";
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import Decimal from "decimal.js";
import { z } from "zod";
import type { Database } from "../db";
import {
  auditLogs,
  commerceEvents,
  commerceFiles,
  customers,
  deliveries,
  deliveryItems,
  dispatches,
  dispatchItems,
  leads,
  orders,
  orderItems,
  orderStages,
  organizations,
  paymentAllocations,
  paymentMilestones,
  payments,
  productionLoads,
  productionLoadItems,
  productionLoadEvents,
} from "../db/schema";
import {
  AccessError,
  adminOrganizations,
  orderPredicate,
  resolveAccess,
  type Access,
} from "../auth/access";
import { buildAuth, type AuthSettings } from "../auth/config";
import type { Permission } from "../auth/roles";
import { eligibleAssignments } from "../leads/access";
import type { FileStore } from "../presales/service";
import { assertUnique, commerceActionSchema, commerceFilters } from "./validation";
type Order = typeof orders.$inferSelect;
const sum = (values: string[]) => values.reduce((n, v) => n.plus(v), new Decimal(0));
const snapshot = (v: unknown) => JSON.parse(JSON.stringify(v)) as Record<string, unknown>;
export function commerceService(db: Database, settings: AuthSettings) {
  const access = (h: Headers, tx = db) => resolveAccess(tx, buildAuth(tx, settings), h);
  const scope = (a: Access): SQL =>
    or(
      ...[...new Set(eligibleAssignments(a, "orders.read").map((s) => s.organizationId))].map(
        (id) => orderPredicate(a, id, "orders.read"),
      ),
    ) ?? sql`false`;
  const permitted = (a: Access, o: Order, p: Permission) =>
    adminOrganizations(a).includes(o.organizationId) ||
    eligibleAssignments(a, p).some(
      (s) => s.organizationId === o.organizationId && s.centreId === o.centreId,
    );
  const requirePermission = (a: Access, o: Order, p: Permission) => {
    if (!permitted(a, o, p))
      throw new AccessError(403, "Your current role cannot perform this operation");
  };
  async function read(tx: Database, a: Access, id: string) {
    const [o] = await tx
      .select({ ...getTableColumns(orders), client: customers.name, company: organizations.name })
      .from(orders)
      .innerJoin(leads, eq(orders.leadId, leads.id))
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .innerJoin(organizations, eq(orders.organizationId, organizations.id))
      .where(and(eq(orders.id, z.uuid().parse(id)), eq(leads.outcome, "won"), scope(a)));
    if (!o) throw new AccessError(404, "Won order unavailable");
    if (
      ![
        "payments.manage",
        "production.manage",
        "orders.manage",
        "installations.manage",
        "audits.manage",
      ].some((p) => permitted(a, o, p as Permission))
    )
      throw new AccessError(403, "Your role cannot view the financial and shipping workspace");
    return o;
  }
  async function transaction<T>(
    h: Headers,
    id: string,
    work: (tx: Database, a: Access, o: Awaited<ReturnType<typeof read>>) => Promise<T>,
  ) {
    return db.transaction(async (t) => {
      const tx = t as unknown as Database;
      await tx.execute(sql`select pg_advisory_xact_lock(73190021)`);
      const a = await access(h, tx);
      return work(tx, a, await read(tx, a, id));
    });
  }
  async function event(
    tx: Database,
    a: Access,
    o: Order,
    id: string,
    action: string,
    notes: string,
    before: unknown,
    after: unknown,
  ) {
    await tx.insert(commerceEvents).values({
      organizationId: o.organizationId,
      orderId: o.id,
      entityId: id,
      actorId: a.user.id,
      action,
      notes,
      before: before ? snapshot(before) : null,
      after: snapshot(after),
    });
    await tx.insert(auditLogs).values({
      organizationId: o.organizationId,
      actorId: a.user.id,
      targetId: id,
      action: `commerce.${action}`,
      metadata: {
        orderId: o.id,
        before: before ? snapshot(before) : null,
        after: snapshot(after),
      },
    });
  }
  async function load(tx: Database, o: Order, id: string) {
    const [l] = await tx
      .select()
      .from(productionLoads)
      .where(and(eq(productionLoads.id, id), eq(productionLoads.orderId, o.id)));
    if (!l) throw new AccessError(404, "Load unavailable");
    return l;
  }
  async function shipment(tx: Database, o: Order, id: string) {
    const [d] = await tx
      .select()
      .from(dispatches)
      .where(and(eq(dispatches.id, id), eq(dispatches.orderId, o.id)));
    if (!d) throw new AccessError(404, "Dispatch unavailable");
    return d;
  }
  function stale(actual: number, expected: number) {
    if (actual !== expected)
      throw new AccessError(409, "This record changed. Reload before saving");
  }
  function actualDate(value: string) {
    if (new Date(value) > new Date())
      throw new AccessError(400, "Actual dates cannot be in the future");
  }
  async function filesRequired(
    tx: Database,
    kind: "paymentId" | "dispatchId" | "deliveryId",
    id: string,
  ) {
    const [f] = await tx
      .select({ id: commerceFiles.id })
      .from(commerceFiles)
      .where(eq(commerceFiles[kind], id))
      .limit(1);
    if (!f)
      throw new AccessError(400, "Upload the required receipt, challan or delivery proof first");
  }
  async function funded(tx: Database, o: Order, loadId: string) {
    const [terms] = await tx
      .select()
      .from(orderStages)
      .where(and(eq(orderStages.orderId, o.id), eq(orderStages.number, 2)));
    if (terms?.status !== "completed")
      throw new AccessError(409, "Approve the payment contract first");
    const milestones = await tx
      .select()
      .from(paymentMilestones)
      .where(and(eq(paymentMilestones.loadId, loadId), eq(paymentMilestones.beforeDispatch, true)));
    if (!milestones.length || milestones.some((m) => new Decimal(m.allocatedAmount).lt(m.amount)))
      throw new AccessError(
        409,
        "The load's contractual payment milestones require verified allocated receipts",
      );
    const receipts = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.orderId, o.id), eq(payments.status, "verified")));
    if (sum(receipts.map((p) => p.amount)).lt(String(terms.data.dueBeforeDispatch)))
      throw new AccessError(
        409,
        "Verified installments do not cover the contractually due cumulative payment",
      );
  }
  async function syncLoad(tx: Database, a: Access, o: Order, id: string) {
    const l = await load(tx, o, id);
    if (!["factory_ready", "dispatched"].includes(l.status)) return;
    const items = await tx
      .select()
      .from(productionLoadItems)
      .where(eq(productionLoadItems.loadId, id));
    const lines = await tx
      .select({ line: dispatchItems, dispatch: dispatches })
      .from(dispatchItems)
      .innerJoin(dispatches, eq(dispatchItems.dispatchId, dispatches.id))
      .where(
        and(
          eq(dispatches.loadId, id),
          inArray(dispatches.status, ["dispatched", "partially_delivered", "delivered"]),
        ),
      );
    const shipped =
      items.length > 0 &&
      items.every((i) =>
        sum(lines.filter((x) => x.line.loadItemId === i.id).map((x) => x.line.quantity)).eq(
          i.quantity,
        ),
      );
    const received =
      shipped &&
      items.every((i) =>
        sum(
          lines.filter((x) => x.line.loadItemId === i.id).map((x) => x.line.deliveredQuantity),
        ).eq(i.quantity),
      );
    const status = received ? "delivered" : shipped ? "dispatched" : l.status;
    if (status === l.status) return;
    const data = { ...l.data };
    const dates = lines.flatMap((x) => (x.dispatch.dispatchedAt ? [x.dispatch.dispatchedAt] : []));
    data.dispatchedAt = new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString();
    data.dispatchedReference = lines
      .map((x) => x.dispatch.reference)
      .filter((v, i, all) => all.indexOf(v) === i)
      .join(", ");
    data.dispatchedBy = a.user.id;
    if (received) {
      const records = await tx
        .select({ at: deliveries.deliveredAt })
        .from(deliveries)
        .innerJoin(dispatches, eq(deliveries.dispatchId, dispatches.id))
        .where(and(eq(dispatches.loadId, id), eq(deliveries.status, "confirmed")));
      data.deliveredAt = new Date(
        Math.max(...records.flatMap((x) => (x.at ? [x.at.getTime()] : []))),
      ).toISOString();
      data.deliveredReference = "Confirmed delivery receipts";
      data.deliveredBy = a.user.id;
    }
    const [next] = await tx
      .update(productionLoads)
      .set({ status, data, version: l.version + 1, updatedAt: new Date() })
      .where(eq(productionLoads.id, id))
      .returning();
    await tx.insert(productionLoadEvents).values({
      organizationId: o.organizationId,
      loadId: id,
      actorId: a.user.id,
      action: `ledger-${status}`,
      notes: "Status derived from actual shipment and confirmed receipt quantities",
      before: snapshot(l),
      after: snapshot(next),
    });
  }
  return {
    async list(h: Headers, mode: "payments" | "dispatch", raw: unknown = {}) {
      const a = await access(h),
        f = commerceFilters.parse(raw);
      if (
        !eligibleAssignments(a, mode === "payments" ? "payments.manage" : "production.manage")
          .length
      )
        throw new AccessError(403);
      const verified = sql<string>`coalesce((select sum(p.amount) from payments p where p.order_id=${orders.id} and p.status='verified'),0)::text`;
      const where = and(
        scope(a),
        eq(leads.outcome, "won"),
        f.organizationId ? eq(orders.organizationId, f.organizationId) : undefined,
        f.q
          ? or(
              ilike(customers.name, `%${f.q}%`),
              ilike(sql<string>`${orders.id}::text`, `%${f.q}%`),
            )
          : undefined,
        f.status === "pending"
          ? sql`exists(select 1 from payments p where p.order_id=${orders.id} and p.status='pending')`
          : f.status === "outstanding"
            ? sql`${orders.finalValue} > (${verified})::numeric`
            : f.status === "partial"
              ? sql`exists(select 1 from dispatches d where d.order_id=${orders.id} and d.status='partially_delivered')`
              : f.status === "delivered"
                ? sql`exists(select 1 from dispatches d where d.order_id=${orders.id} and d.status='delivered')`
                : undefined,
      );
      const rows = await db
        .select({
          id: orders.id,
          client: customers.name,
          company: organizations.name,
          value: orders.finalValue,
          recorded: orders.recordedPaymentAmount,
          verified,
          shipments: sql<number>`(select count(*)::int from dispatches d where d.order_id=${orders.id} and d.status<>'cancelled')`,
          pendingApprovals: sql<number>`(select count(*)::int from dispatches d where d.order_id=${orders.id} and d.status='draft')`,
        })
        .from(orders)
        .innerJoin(leads, eq(orders.leadId, leads.id))
        .innerJoin(customers, eq(orders.customerId, customers.id))
        .innerJoin(organizations, eq(orders.organizationId, organizations.id))
        .where(where)
        .orderBy(desc(orders.createdAt), asc(orders.id))
        .limit(20)
        .offset((f.page - 1) * 20);
      const [total] = await db
        .select({ total: count() })
        .from(orders)
        .innerJoin(leads, eq(orders.leadId, leads.id))
        .innerJoin(customers, eq(orders.customerId, customers.id))
        .where(where);
      const companies = await db
        .select()
        .from(organizations)
        .where(
          or(
            ...eligibleAssignments(a, "orders.read").map((s) =>
              eq(organizations.id, s.organizationId),
            ),
          ) ?? sql`false`,
        );
      return {
        rows: rows.map((r) => ({
          ...r,
          outstanding: new Decimal(r.value ?? "0").minus(r.verified).toFixed(2),
        })),
        total: total.total,
        companies,
        filters: f,
      };
    },
    async detail(h: Headers, id: string, rawPage: unknown = 1) {
      const a = await access(h),
        o = await read(db, a, id),
        page = z.coerce.number().int().min(1).max(100000).parse(rawPage);
      const receipts = await db
        .select()
        .from(payments)
        .where(eq(payments.orderId, id))
        .orderBy(desc(payments.receivedAt));
      const milestones = await db
        .select()
        .from(paymentMilestones)
        .where(eq(paymentMilestones.orderId, id))
        .orderBy(asc(paymentMilestones.createdAt));
      const shipments = await db
        .select()
        .from(dispatches)
        .where(eq(dispatches.orderId, id))
        .orderBy(desc(dispatches.createdAt));
      const received = await db
        .select()
        .from(deliveries)
        .where(eq(deliveries.orderId, id))
        .orderBy(desc(deliveries.createdAt));
      const allocated = await db
        .select()
        .from(paymentAllocations)
        .where(eq(paymentAllocations.orderId, id));
      const loadRows = await db
        .select()
        .from(productionLoads)
        .where(eq(productionLoads.orderId, id))
        .orderBy(asc(productionLoads.loadNumber));
      const loadItems = await db
        .select({
          ...getTableColumns(productionLoadItems),
          name: orderItems.name,
          description: orderItems.description,
        })
        .from(productionLoadItems)
        .innerJoin(orderItems, eq(productionLoadItems.orderItemId, orderItems.id))
        .innerJoin(productionLoads, eq(productionLoadItems.loadId, productionLoads.id))
        .where(eq(productionLoads.orderId, id));
      const lines = await db
        .select({ item: dispatchItems })
        .from(dispatchItems)
        .innerJoin(dispatches, eq(dispatchItems.dispatchId, dispatches.id))
        .where(eq(dispatches.orderId, id));
      const deliveryLines = await db
        .select({ item: deliveryItems })
        .from(deliveryItems)
        .innerJoin(deliveries, eq(deliveryItems.deliveryId, deliveries.id))
        .where(eq(deliveries.orderId, id));
      const files = await db
        .select({
          id: commerceFiles.id,
          name: commerceFiles.name,
          paymentId: commerceFiles.paymentId,
          dispatchId: commerceFiles.dispatchId,
          deliveryId: commerceFiles.deliveryId,
          createdAt: commerceFiles.createdAt,
        })
        .from(commerceFiles)
        .where(eq(commerceFiles.orderId, id));
      const canFinance = permitted(a, o, "payments.manage");
      const eventWhere = and(
        eq(commerceEvents.orderId, id),
        canFinance
          ? undefined
          : or(
              ilike(commerceEvents.action, "dispatch.%"),
              ilike(commerceEvents.action, "delivery.%"),
            ),
      );
      const events = await db
        .select()
        .from(commerceEvents)
        .where(eventWhere)
        .orderBy(desc(commerceEvents.createdAt), desc(commerceEvents.id))
        .limit(20)
        .offset((page - 1) * 20);
      const [total] = await db.select({ total: count() }).from(commerceEvents).where(eventWhere);
      const verified = sum(receipts.filter((p) => p.status === "verified").map((p) => p.amount));
      return {
        order: o,
        templates: adminOrganizations(a).includes(o.organizationId)
          ? await db
              .select({ id: adminCatalog.id, name: adminCatalog.name, config: adminCatalog.config })
              .from(adminCatalog)
              .where(
                and(
                  eq(adminCatalog.organizationId, o.organizationId),
                  eq(adminCatalog.kind, "payment_template"),
                  eq(adminCatalog.active, true),
                ),
              )
          : [],
        payments: canFinance ? receipts : [],
        milestones,
        allocations: canFinance ? allocated : [],
        loads: loadRows,
        loadItems,
        dispatches: shipments,
        dispatchItems: lines.map((l) => l.item),
        deliveries: received,
        deliveryItems: deliveryLines.map((l) => l.item),
        files: canFinance ? files : files.filter((f) => !f.paymentId),
        events,
        historyPage: page,
        historyTotal: total.total,
        totals: {
          received: sum(
            receipts.filter((p) => p.status !== "rejected").map((p) => p.amount),
          ).toFixed(2),
          verified: verified.toFixed(2),
          outstanding: new Decimal(o.finalValue ?? "0").minus(verified).toFixed(2),
        },
        permissions: {
          payments: permitted(a, o, "payments.manage"),
          production: permitted(a, o, "production.manage"),
          approve: permitted(a, o, "orders.manage"),
          configure: adminOrganizations(a).includes(o.organizationId),
        },
      };
    },
    async command(h: Headers, id: string, raw: unknown) {
      const input = commerceActionSchema.parse(raw);
      return transaction(h, id, async (tx, a, o) => {
        const org = { organizationId: o.organizationId, orderId: o.id };
        let entityId = "",
          before: unknown = null,
          after: unknown;
        if (input.action === "payment.record") {
          requirePermission(a, o, "payments.manage");
          actualDate(input.receivedAt);
          if (new Decimal(o.recordedPaymentAmount).plus(input.amount).gt(o.finalValue ?? "0"))
            throw new AccessError(409, "Reported installments exceed the final order value");
          const [duplicate] = await tx
            .select({ id: payments.id })
            .from(payments)
            .where(
              and(
                eq(payments.organizationId, o.organizationId),
                sql`lower(btrim(${payments.reference}))=${input.reference.toLowerCase()}`,
                sql`${payments.status}<>'rejected'`,
              ),
            );
          if (duplicate)
            throw new AccessError(
              409,
              "A receipt with this transaction reference is already recorded",
            );
          const [p] = await tx
            .insert(payments)
            .values({
              ...org,
              amount: input.amount,
              mode: input.mode,
              reference: input.reference,
              receivedAt: new Date(input.receivedAt),
              notes: input.notes,
              recordedBy: a.user.id,
            })
            .returning();
          entityId = p.id;
          after = p;
        } else if (input.action === "payment.verify" || input.action === "payment.reject") {
          requirePermission(a, o, "payments.manage");
          const [p] = await tx
            .select()
            .from(payments)
            .where(and(eq(payments.id, input.id), eq(payments.orderId, id)));
          if (!p) throw new AccessError(404, "Receipt unavailable");
          stale(p.version, input.version);
          if (p.status !== "pending")
            throw new AccessError(409, "This receipt already has an immutable decision");
          if (input.action === "payment.verify") await filesRequired(tx, "paymentId", p.id);
          const [next] = await tx
            .update(payments)
            .set({
              status: input.action === "payment.verify" ? "verified" : "rejected",
              verifiedBy: input.action === "payment.verify" ? a.user.id : null,
              verifiedAt: input.action === "payment.verify" ? new Date() : null,
              rejectionReason: input.action === "payment.reject" ? input.notes : null,
              version: p.version + 1,
              updatedAt: new Date(),
            })
            .where(eq(payments.id, p.id))
            .returning();
          entityId = p.id;
          before = p;
          after = next;
        } else if (input.action === "milestone.save") {
          if (!adminOrganizations(a).includes(o.organizationId))
            throw new AccessError(
              403,
              "Only an organization administrator configures payment milestones",
            );
          if (o.stage > 15 || o.completedAt)
            throw new AccessError(409, "Handover terms are immutable");
          await load(tx, o, input.loadId);
          const list = await tx
            .select()
            .from(paymentMilestones)
            .where(eq(paymentMilestones.orderId, id));
          const old = input.id ? list.find((m) => m.id === input.id) : undefined;
          if (input.id && !old) throw new AccessError(404, "Milestone unavailable");
          stale(old?.version ?? 0, input.version);
          const approved = await tx
            .select()
            .from(dispatches)
            .where(
              and(
                eq(dispatches.loadId, input.loadId),
                inArray(dispatches.status, [
                  "approved",
                  "dispatched",
                  "partially_delivered",
                  "delivered",
                ]),
              ),
            );
          if (
            (old && (new Decimal(old.allocatedAmount).gt(0) || old.loadId !== input.loadId)) ||
            approved.length
          )
            throw new AccessError(409, "Funded or approved shipment terms cannot be rewritten");
          if (
            sum(list.filter((m) => m.id !== input.id).map((m) => m.amount))
              .plus(input.amount)
              .gt(o.finalValue ?? "0")
          )
            throw new AccessError(400, "Configured milestones exceed order value");
          const values = {
            ...org,
            loadId: input.loadId,
            name: input.name,
            amount: input.amount,
            dueAt: input.dueAt ? new Date(input.dueAt) : null,
            beforeDispatch: input.beforeDispatch,
            contractReference: input.contractReference,
            notes: input.notes,
            configuredBy: a.user.id,
            version: (old?.version ?? 0) + 1,
            updatedAt: new Date(),
          };
          const [m] = old
            ? await tx
                .update(paymentMilestones)
                .set(values)
                .where(eq(paymentMilestones.id, old.id))
                .returning()
            : await tx.insert(paymentMilestones).values(values).returning();
          entityId = m.id;
          before = old;
          after = m;
        } else if (input.action === "payment.allocate") {
          requirePermission(a, o, "payments.manage");
          const [p] = await tx
            .select()
            .from(payments)
            .where(and(eq(payments.id, input.paymentId), eq(payments.orderId, id)));
          const [m] = await tx
            .select()
            .from(paymentMilestones)
            .where(
              and(eq(paymentMilestones.id, input.milestoneId), eq(paymentMilestones.orderId, id)),
            );
          if (!p || !m) throw new AccessError(404, "Receipt or milestone unavailable");
          if (p.status !== "verified")
            throw new AccessError(409, "Verify this receipt before allocating funds");
          if (
            new Decimal(p.allocatedAmount).plus(input.amount).gt(p.amount) ||
            new Decimal(m.allocatedAmount).plus(input.amount).gt(m.amount)
          )
            throw new AccessError(
              409,
              "Allocation exceeds the receipt or milestone remaining balance",
            );
          const [old] = await tx
            .select()
            .from(paymentAllocations)
            .where(
              and(eq(paymentAllocations.paymentId, p.id), eq(paymentAllocations.milestoneId, m.id)),
            );
          if (old)
            throw new AccessError(409, "This receipt is already allocated to this milestone");
          const [allocation] = await tx
            .insert(paymentAllocations)
            .values({
              ...org,
              paymentId: p.id,
              milestoneId: m.id,
              amount: input.amount,
              allocatedBy: a.user.id,
            })
            .returning();
          entityId = allocation.id;
          after = allocation;
        } else if (input.action === "dispatch.create") {
          requirePermission(a, o, "production.manage");
          const l = await load(tx, o, input.loadId);
          if (l.status !== "factory_ready")
            throw new AccessError(409, "Confirm factory readiness before creating a dispatch");
          assertUnique(input.items.map((i) => i.loadItemId));
          const items = await tx
            .select()
            .from(productionLoadItems)
            .where(eq(productionLoadItems.loadId, l.id));
          for (const row of input.items) {
            const item = items.find((i) => i.id === row.loadItemId);
            if (!item || new Decimal(item.dispatchedQuantity).plus(row.quantity).gt(item.quantity))
              throw new AccessError(409, "Dispatch exceeds the remaining load item quantity");
          }
          const [d] = await tx
            .insert(dispatches)
            .values({
              ...org,
              loadId: l.id,
              reference: input.reference,
              transporter: input.transporter,
              vehicleNumber: input.vehicleNumber,
              expectedAt: new Date(input.expectedAt),
              notes: input.notes,
            })
            .returning();
          await tx.insert(dispatchItems).values(
            input.items.map((i) => ({
              ...i,
              organizationId: o.organizationId,
              dispatchId: d.id,
            })),
          );
          entityId = d.id;
          after = { dispatch: d, items: input.items };
        } else if (
          input.action === "dispatch.approve" ||
          input.action === "dispatch.cancel" ||
          input.action === "dispatch.ship"
        ) {
          requirePermission(
            a,
            o,
            input.action === "dispatch.approve" ? "orders.manage" : "production.manage",
          );
          const d = await shipment(tx, o, input.id);
          stale(d.version, input.version);
          if (
            input.action === "dispatch.cancel"
              ? !["draft", "approved"].includes(d.status)
              : d.status !== (input.action === "dispatch.approve" ? "draft" : "approved")
          )
            throw new AccessError(409, "Dispatch is not in the required state");
          if (input.action !== "dispatch.cancel") {
            await filesRequired(tx, "dispatchId", d.id);
            await funded(tx, o, d.loadId);
            const l = await load(tx, o, d.loadId);
            if (!["factory_ready", "dispatched"].includes(l.status))
              throw new AccessError(409, "Factory readiness is required");
            if (input.action === "dispatch.ship") {
              actualDate(input.dispatchedAt);
              if (new Date(input.dispatchedAt) > new Date(d.expectedAt!))
                throw new AccessError(400, "Expected delivery must follow dispatch date");
              if (
                l.data.factory_readyAt &&
                new Date(input.dispatchedAt) < new Date(String(l.data.factory_readyAt))
              )
                throw new AccessError(400, "Dispatch cannot precede factory readiness");
            }
          }
          const [next] = await tx
            .update(dispatches)
            .set({
              status:
                input.action === "dispatch.cancel"
                  ? "cancelled"
                  : input.action === "dispatch.approve"
                    ? "approved"
                    : "dispatched",
              approvedBy: input.action === "dispatch.approve" ? a.user.id : d.approvedBy,
              approvedAt: input.action === "dispatch.approve" ? new Date() : d.approvedAt,
              dispatchedAt:
                input.action === "dispatch.ship" ? new Date(input.dispatchedAt) : d.dispatchedAt,
              version: d.version + 1,
              updatedAt: new Date(),
            })
            .where(eq(dispatches.id, d.id))
            .returning();
          entityId = d.id;
          before = d;
          after = next;
          if (input.action === "dispatch.ship") await syncLoad(tx, a, o, d.loadId);
        } else if (input.action === "delivery.create") {
          requirePermission(a, o, "production.manage");
          const d = await shipment(tx, o, input.dispatchId);
          if (!["dispatched", "partially_delivered"].includes(d.status))
            throw new AccessError(409, "Dispatch this shipment before recording delivery");
          actualDate(input.deliveredAt);
          if (new Date(input.deliveredAt) < d.dispatchedAt!)
            throw new AccessError(400, "Delivery cannot precede dispatch");
          assertUnique(input.items.map((i) => i.dispatchItemId));
          const items = await tx
            .select()
            .from(dispatchItems)
            .where(eq(dispatchItems.dispatchId, d.id));
          for (const row of input.items) {
            const i = items.find((i) => i.id === row.dispatchItemId);
            if (
              !i ||
              new Decimal(i.deliveredQuantity).plus(row.received).plus(row.missing).gt(i.quantity)
            )
              throw new AccessError(409, "Delivery exceeds the remaining shipped quantity");
          }
          const [r] = await tx
            .insert(deliveries)
            .values({
              ...org,
              dispatchId: d.id,
              deliveredAt: new Date(input.deliveredAt),
              receivedBy: input.receivedBy,
              remarks: input.remarks,
            })
            .returning();
          await tx.insert(deliveryItems).values(
            input.items.map((i) => ({
              ...i,
              organizationId: o.organizationId,
              deliveryId: r.id,
            })),
          );
          entityId = r.id;
          after = { delivery: r, items: input.items };
        } else if (input.action === "delivery.confirm" || input.action === "delivery.cancel") {
          requirePermission(a, o, "production.manage");
          const [r] = await tx
            .select()
            .from(deliveries)
            .where(and(eq(deliveries.id, input.id), eq(deliveries.orderId, id)));
          if (!r) throw new AccessError(404, "Delivery unavailable");
          stale(r.version, input.version);
          if (r.status !== "draft")
            throw new AccessError(409, "This delivery is already confirmed");
          if (input.action === "delivery.confirm") await filesRequired(tx, "deliveryId", r.id);
          const lines = await tx
            .select({ line: deliveryItems, dispatch: dispatchItems })
            .from(deliveryItems)
            .innerJoin(dispatchItems, eq(deliveryItems.dispatchItemId, dispatchItems.id))
            .where(eq(deliveryItems.deliveryId, r.id));
          for (const row of lines)
            if (
              input.action === "delivery.confirm" &&
              new Decimal(row.dispatch.deliveredQuantity)
                .plus(row.line.received)
                .plus(row.line.missing)
                .gt(row.dispatch.quantity)
            )
              throw new AccessError(
                409,
                "Other deliveries consumed this shipment balance. Reload before confirming",
              );
          const [next] = await tx
            .update(deliveries)
            .set({
              status: input.action === "delivery.confirm" ? "confirmed" : "cancelled",
              confirmedBy: input.action === "delivery.confirm" ? a.user.id : null,
              confirmedAt: input.action === "delivery.confirm" ? new Date() : null,
              version: r.version + 1,
              updatedAt: new Date(),
            })
            .where(eq(deliveries.id, r.id))
            .returning();
          entityId = r.id;
          before = r;
          after = { delivery: next, items: lines.map((x) => x.line) };
          if (input.action === "delivery.confirm")
            await syncLoad(tx, a, o, (await shipment(tx, o, r.dispatchId)).loadId);
        }
        await event(
          tx,
          a,
          o,
          entityId,
          input.action,
          "remarks" in input ? input.remarks : input.notes,
          before,
          after,
        );
        return { id: entityId };
      });
    },
    async upload(
      h: Headers,
      id: string,
      kind: "payment" | "dispatch" | "delivery",
      target: string,
      input: { name: string; contentType: string; bytes: Uint8Array },
      store: FileStore,
    ) {
      const name = z.string().trim().min(1).max(180).parse(input.name);
      z.uuid().parse(target);
      const bytes = input.bytes;
      if (bytes.length < 1 || bytes.length > 4194304)
        throw new AccessError(400, "Files must be 1 byte to 4 MiB");
      const valid =
        input.contentType === "application/pdf"
          ? Buffer.from(bytes.slice(0, 5)).toString() === "%PDF-"
          : input.contentType === "image/png"
            ? Buffer.from(bytes.slice(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : input.contentType === "image/jpeg"
              ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
              : false;
      if (!valid) throw new AccessError(400, "Upload a valid PDF, JPEG or PNG");
      let uploaded: string | undefined;
      try {
        return await transaction(h, id, async (tx, a, o) => {
          requirePermission(a, o, kind === "payment" ? "payments.manage" : "production.manage");
          if (kind === "payment") {
            const [p] = await tx
              .select()
              .from(payments)
              .where(and(eq(payments.id, target), eq(payments.orderId, id)));
            if (!p) throw new AccessError(404);
            if (p.status !== "pending")
              throw new AccessError(409, "Receipt evidence is locked after verification");
          } else if (kind === "dispatch") {
            const d = await shipment(tx, o, target);
            if (d.status !== "draft")
              throw new AccessError(409, "Challan is locked after approval");
          } else {
            const [r] = await tx
              .select()
              .from(deliveries)
              .where(and(eq(deliveries.id, target), eq(deliveries.orderId, id)));
            if (!r) throw new AccessError(404);
            if (r.status !== "draft")
              throw new AccessError(409, "Proof is locked after confirmation");
          }
          const path = `${o.organizationId}/${id}/commerce/${kind}/${target}/${crypto.randomUUID()}`;
          await store.upload(path, bytes, input.contentType);
          uploaded = path;
          const [file] = await tx
            .insert(commerceFiles)
            .values({
              organizationId: o.organizationId,
              orderId: id,
              [`${kind}Id`]: target,
              uploadedBy: a.user.id,
              name,
              objectPath: path,
              contentType: input.contentType,
              byteSize: bytes.length,
            })
            .returning();
          await event(tx, a, o, target, `${kind}.file-uploaded`, name, null, {
            fileId: file.id,
            name,
          });
          return { id: file.id };
        });
      } catch (error) {
        if (uploaded) await store.remove(uploaded).catch(() => undefined);
        throw error;
      }
    },
    async download(h: Headers, id: string, fileId: string, store: FileStore) {
      const a = await access(h),
        o = await read(db, a, id);
      const [file] = await db
        .select()
        .from(commerceFiles)
        .where(
          and(
            eq(commerceFiles.id, z.uuid().parse(fileId)),
            eq(commerceFiles.orderId, id),
            eq(commerceFiles.organizationId, o.organizationId),
          ),
        );
      if (!file) throw new AccessError(404);
      if (file.paymentId) requirePermission(a, o, "payments.manage");
      return { url: await store.sign(file.objectPath), expiresIn: 60 };
    },
  };
}
