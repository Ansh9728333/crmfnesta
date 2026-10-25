import { and, asc, count, desc, eq, getTableColumns, ilike, or, sql, type SQL } from "drizzle-orm";
import Decimal from "decimal.js";
import { z } from "zod";
import type { Database } from "../db";
import {
  auditLogs,
  customers,
  leads,
  orders,
  orderItems,
  orderStages,
  organizations,
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
import { orderService } from "../orders/service";
import { allocationSchema, loadActionSchema, loadFiltersSchema, loadStatuses } from "./validation";
const snapshot = (v: unknown) => JSON.parse(JSON.stringify(v)) as Record<string, unknown>;
type Order = typeof orders.$inferSelect;
export function productionService(db: Database, settings: AuthSettings) {
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
  function requirePermission(a: Access, o: Order, p: Permission) {
    if (!permitted(a, o, p))
      throw new AccessError(403, "Your current role cannot perform this load operation");
  }
  async function read(tx: Database, a: Access, id: string) {
    const [o] = await tx
      .select({
        ...getTableColumns(orders),
        client: customers.name,
        company: organizations.name,
        companySlug: organizations.slug,
      })
      .from(orders)
      .innerJoin(leads, eq(orders.leadId, leads.id))
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .innerJoin(organizations, eq(orders.organizationId, organizations.id))
      .where(and(eq(orders.id, z.uuid().parse(id)), eq(leads.outcome, "won"), scope(a)));
    if (!o) throw new AccessError(404, "Order unavailable");
    return o;
  }
  async function transaction<T>(h: Headers, work: (tx: Database, a: Access) => Promise<T>) {
    return db.transaction(async (t) => {
      const tx = t as unknown as Database;
      await tx.execute(sql`select pg_advisory_xact_lock(73190021)`);
      return work(tx, await access(h, tx));
    });
  }
  async function event(
    tx: Database,
    a: Access,
    load: typeof productionLoads.$inferSelect,
    action: string,
    notes: string,
    before: unknown,
    allocations?: unknown,
  ) {
    await tx.insert(productionLoadEvents).values({
      organizationId: load.organizationId,
      loadId: load.id,
      actorId: a.user.id,
      action,
      notes,
      before: before ? snapshot(before) : null,
      after: snapshot({ load, allocations }),
    });
    await tx.insert(auditLogs).values({
      organizationId: load.organizationId,
      actorId: a.user.id,
      targetId: load.id,
      action: `production.${action}`,
      metadata: { orderId: load.orderId, version: load.version },
    });
  }
  async function allocate(
    tx: Database,
    o: Order,
    load: typeof productionLoads.$inferSelect,
    plan: z.infer<typeof allocationSchema>,
  ) {
    if (plan.orderId !== o.id || load.status !== "planned")
      throw new AccessError(409, "Only planned loads can be allocated");
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, o.id));
    const existing = await tx
      .select()
      .from(productionLoadItems)
      .where(eq(productionLoadItems.loadId, load.id));
    for (const row of plan.allocations) {
      const item = items.find((i) => i.id === row.orderItemId);
      if (!item) throw new AccessError(400, "Choose items from this order");
      const own = existing.find((i) => i.orderItemId === row.orderItemId)?.quantity ?? "0";
      if (new Decimal(item.allocatedQuantity).minus(own).plus(row.quantity).gt(item.quantity))
        throw new AccessError(409, "Allocation exceeds the remaining confirmed item quantity");
    }
    await tx.delete(productionLoadItems).where(eq(productionLoadItems.loadId, load.id));
    await tx
      .insert(productionLoadItems)
      .values(
        plan.allocations.map((i) => ({ ...i, loadId: load.id, organizationId: o.organizationId })),
      );
  }
  async function owner(tx: Database, h: Headers, o: Order, id: string) {
    const detail = await orderService(tx, settings).detail(h, o.id);
    if (
      !detail.employees.some(
        (p) =>
          p.id === id &&
          p.permissions.includes("production.manage") &&
          p.permissions.includes("orders.read"),
      )
    )
      throw new AccessError(400, "Assign an active production employee in this branch");
  }
  return {
    async list(h: Headers, raw: unknown = {}) {
      const a = await access(h),
        f = loadFiltersSchema.parse(raw);
      const where = and(
        scope(a),
        eq(leads.outcome, "won"),
        f.orderId ? eq(orders.id, f.orderId) : undefined,
        f.organizationId ? eq(orders.organizationId, f.organizationId) : undefined,
        f.status ? eq(productionLoads.status, f.status) : undefined,
        f.readiness ? eq(productionLoads.siteReady, f.readiness === "ready") : undefined,
        f.q
          ? or(
              ilike(customers.name, `%${f.q}%`),
              ilike(sql<string>`${orders.id}::text`, `%${f.q}%`),
              ilike(sql<string>`${productionLoads.data}->>'releasedReference'`, `%${f.q}%`),
            )
          : undefined,
      );
      const query = () =>
        db
          .select({ load: productionLoads, client: customers.name, company: organizations.name })
          .from(productionLoads)
          .innerJoin(orders, eq(productionLoads.orderId, orders.id))
          .innerJoin(leads, eq(orders.leadId, leads.id))
          .innerJoin(customers, eq(orders.customerId, customers.id))
          .innerJoin(organizations, eq(orders.organizationId, organizations.id));
      const rows = await query()
        .where(where)
        .orderBy(desc(productionLoads.createdAt), asc(productionLoads.loadNumber))
        .limit(20)
        .offset((f.page - 1) * 20);
      const [total] = await db
        .select({ total: count() })
        .from(productionLoads)
        .innerJoin(orders, eq(productionLoads.orderId, orders.id))
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
      return { rows, total: total.total, companies, filters: f };
    },
    async planning(h: Headers, id: string) {
      const a = await access(h),
        o = await read(db, a, id),
        detail = await orderService(db, settings).detail(h, id);
      return {
        order: o,
        items: detail.items,
        loads: detail.loads,
        employees: detail.employees.filter(
          (p) =>
            p.permissions.includes("production.manage") && p.permissions.includes("orders.read"),
        ),
        canManage: permitted(a, o, "production.manage"),
      };
    },
    async detail(h: Headers, id: string, rawPage: unknown = 1) {
      const a = await access(h);
      const [load] = await db
        .select()
        .from(productionLoads)
        .where(eq(productionLoads.id, z.uuid().parse(id)));
      if (!load) throw new AccessError(404, "Load unavailable");
      const o = await read(db, a, load.orderId);
      const planning = await this.planning(h, o.id);
      const allocations = await db
        .select()
        .from(productionLoadItems)
        .where(eq(productionLoadItems.loadId, id));
      const page = z.coerce.number().int().min(1).max(100000).parse(rawPage);
      const events = await db
        .select()
        .from(productionLoadEvents)
        .where(eq(productionLoadEvents.loadId, id))
        .orderBy(desc(productionLoadEvents.createdAt), desc(productionLoadEvents.id))
        .limit(20)
        .offset((page - 1) * 20);
      const [total] = await db
        .select({ total: count() })
        .from(productionLoadEvents)
        .where(eq(productionLoadEvents.loadId, id));
      return {
        ...planning,
        load,
        allocations,
        events,
        historyPage: page,
        historyTotal: total.total,
        permissions: {
          production: permitted(a, o, "production.manage"),
          payment: permitted(a, o, "payments.manage"),
          installation: permitted(a, o, "installations.manage"),
          audit: permitted(a, o, "audits.manage"),
        },
      };
    },
    async create(h: Headers, raw: unknown) {
      const plan = allocationSchema.parse(raw);
      return transaction(h, async (tx, a) => {
        const o = await read(tx, a, plan.orderId);
        requirePermission(a, o, "production.manage");
        if (o.completedAt || o.stage > 15)
          throw new AccessError(409, "Handover orders cannot receive new loads");
        await owner(tx, h, o, plan.assignedTo);
        const existing = await tx
          .select()
          .from(productionLoads)
          .where(eq(productionLoads.orderId, o.id));
        if (existing.length >= 100) throw new AccessError(400, "An order supports up to 100 loads");
        const [load] = await tx
          .insert(productionLoads)
          .values({
            orderId: o.id,
            organizationId: o.organizationId,
            loadNumber: Math.max(0, ...existing.map((l) => l.loadNumber)) + 1,
            assignedTo: plan.assignedTo,
            siteReady: plan.siteReady,
          })
          .returning();
        await allocate(tx, o, load, plan);
        await event(tx, a, load, "created", plan.notes, null, plan.allocations);
        return { id: load.id };
      });
    },
    async change(h: Headers, id: string, raw: unknown) {
      const input = loadActionSchema.parse(raw);
      return transaction(h, async (tx, a) => {
        const [old] = await tx
          .select()
          .from(productionLoads)
          .where(eq(productionLoads.id, z.uuid().parse(id)));
        if (!old) throw new AccessError(404, "Load unavailable");
        const o = await read(tx, a, old.orderId);
        if (o.completedAt || o.stage > 15 || old.status === "completed")
          throw new AccessError(409, "Completed records are immutable");
        if (input.version !== old.version)
          throw new AccessError(409, "This load changed. Reload before saving");
        const data = { ...old.data };
        let status = old.status,
          siteReady = old.siteReady,
          assignedTo = old.assignedTo,
          completedAt = old.completedAt;
        if (input.action === "allocate") {
          requirePermission(a, o, "production.manage");
          await owner(tx, h, o, input.plan.assignedTo);
          await allocate(tx, o, old, input.plan);
          assignedTo = input.plan.assignedTo;
          siteReady = input.plan.siteReady;
        } else if (input.action === "readiness") {
          requirePermission(a, o, "production.manage");
          if (old.status !== "planned")
            throw new AccessError(409, "Readiness is fixed after release");
          siteReady = input.siteReady;
        } else if (input.action === "payment") {
          throw new AccessError(
            409,
            "Record and allocate verified installments in Payment Management",
          );
        } else {
          if (
            [
              "dispatched",
              "delivered",
              "installation_started",
              "installed",
              "audit_passed",
              "completed",
            ].includes(input.target)
          )
            throw new AccessError(
              409,
              "Use dispatch, installation and audit management for evidence-backed transitions",
            );
          const index = loadStatuses.indexOf(old.status as (typeof loadStatuses)[number]);
          if (loadStatuses[index + 1] !== input.target)
            throw new AccessError(409, "Complete the preceding load activity first");
          const p =
            input.target === "audit_passed"
              ? "audits.manage"
              : ["installation_started", "installed"].includes(input.target)
                ? "installations.manage"
                : "production.manage";
          requirePermission(a, o, p);
          const allocations = await tx
            .select()
            .from(productionLoadItems)
            .where(eq(productionLoadItems.loadId, id));
          if (!allocations.length)
            throw new AccessError(409, "Allocate confirmed items before releasing this load");
          if (input.target === "released") {
            const stages = await tx.select().from(orderStages).where(eq(orderStages.orderId, o.id));
            if (
              ![4, 5, 6].every((n) =>
                stages.some((s) => s.number === n && s.status === "completed" && s.approvedBy),
              )
            )
              throw new AccessError(
                409,
                "Approve survey, site readiness and load planning before release",
              );
            if (!old.siteReady) throw new AccessError(409, "This load is pending site readiness");
          }
          if (input.target === "in_production") {
            if (!input.estimatedAt || new Date(input.estimatedAt) < new Date(input.occurredAt))
              throw new AccessError(400, "Estimated completion must follow production start");
            data.estimatedCompletionAt = input.estimatedAt;
          }
          if (new Date(input.occurredAt) > new Date())
            throw new AccessError(400, "Actual activity dates cannot be in the future");
          const previous = String(data[`${old.status}At`] ?? "");
          if (previous && new Date(input.occurredAt) < new Date(previous))
            throw new AccessError(400, "Activity date precedes its prerequisite");
          if (o.companySlug === "s-grip" && input.target === "installation_started") {
            if (typeof input.glassRequired !== "boolean")
              throw new AccessError(400, "Select Glass Required Yes or No");
            data.glassRequired = input.glassRequired;
          }
          if (
            o.companySlug === "s-grip" &&
            input.target === "installed" &&
            data.glassRequired === true
          ) {
            if (
              !input.glassMeasurementTaken ||
              !input.glassTemplatePrepared ||
              !input.glassTemplateApproved
            )
              throw new AccessError(
                400,
                "Complete glass measurement, template preparation and approval inside this order",
              );
            Object.assign(data, {
              glassMeasurementTaken: true,
              glassTemplatePrepared: true,
              glassTemplateApproved: true,
            });
          }
          status = input.target;
          Object.assign(data, {
            [`${status}At`]: input.occurredAt,
            [`${status}Reference`]: input.reference,
            [`${status}By`]: a.user.id,
          });
          if (status === "completed") completedAt = new Date(input.occurredAt);
        }
        const [load] = await tx
          .update(productionLoads)
          .set({
            status,
            siteReady,
            assignedTo,
            data,
            completedAt,
            version: old.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(productionLoads.id, id))
          .returning();
        await event(
          tx,
          a,
          load,
          input.action,
          input.action === "allocate" ? input.plan.notes : input.notes,
          old,
          input.action === "allocate" ? input.plan.allocations : undefined,
        );
        return { id };
      });
    },
  };
}
