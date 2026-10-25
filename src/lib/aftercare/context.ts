import { and, eq, or, sql, getTableColumns, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db";
import * as s from "../db/schema";
import {
  AccessError,
  adminOrganizations,
  orderPredicate,
  resolveAccess,
  type Access,
} from "../auth/access";
import { buildAuth, type AuthSettings } from "../auth/config";
import { eligibleAssignments } from "../leads/access";
import { permissions, type Permission } from "../auth/roles";
export type Order = typeof s.orders.$inferSelect;
export const snapshot = (v: unknown) => JSON.parse(JSON.stringify(v)) as Record<string, unknown>;
export function fail(message: string): never {
  throw new AccessError(400, message);
}
export function stale(actual: number, expected: number) {
  if (actual !== expected) throw new AccessError(409, "This record changed. Reload before saving");
}
export function actual(value: string, earliest?: Date | null) {
  const d = new Date(value);
  if (d > new Date() || (earliest && d < earliest))
    fail("Actual date must follow prerequisite work and cannot be in the future");
  return d;
}
export function can(a: Access, o: Order, p: Permission) {
  return (
    adminOrganizations(a).includes(o.organizationId) ||
    eligibleAssignments(a, p).some(
      (x) => x.organizationId === o.organizationId && x.centreId === o.centreId,
    )
  );
}
export function need(a: Access, o: Order, p: Permission) {
  if (!can(a, o, p)) throw new AccessError(403, "Your current role cannot perform this action");
}
export function featureScope(a: Access) {
  return (
    or(
      ...a.assignments
        .filter((x) =>
          (
            ["orders.manage", "installations.manage", "audits.manage", "service.manage"] as const
          ).some((p) =>
            can(a, { organizationId: x.organizationId, centreId: x.centreId } as Order, p),
          ),
        )
        .map((x) =>
          and(
            eq(s.orders.organizationId, x.organizationId),
            ["Admin", "Super Admin"].includes(x.role)
              ? undefined
              : eq(s.orders.centreId, x.centreId),
          ),
        ),
    ) ?? sql`false`
  );
}
export function assigned(a: Access, o: Order, p: Permission, ids: (string | null)[]) {
  need(a, o, p);
  if (!adminOrganizations(a).includes(o.organizationId) && !ids.includes(a.user.id))
    throw new AccessError(403, "This work is assigned to another employee");
}
export async function people(tx: Database, o: Order) {
  const rows = await tx
    .select({
      id: s.user.id,
      name: s.user.name,
      role: s.employeeRoleAssignments.role,
      centreId: s.employeeRoleAssignments.centreId,
    })
    .from(s.employeeRoleAssignments)
    .innerJoin(s.user, eq(s.user.id, s.employeeRoleAssignments.userId))
    .innerJoin(s.employeeProfiles, eq(s.employeeProfiles.userId, s.user.id))
    .innerJoin(s.centres, eq(s.centres.id, s.employeeRoleAssignments.centreId))
    .where(
      and(
        eq(s.employeeRoleAssignments.organizationId, o.organizationId),
        eq(s.employeeProfiles.active, true),
        eq(s.centres.active, true),
        or(eq(s.user.banned, false), isNull(s.user.banned)),
      ),
    );
  const grants = await tx
    .select()
    .from(s.rolePermissions)
    .where(eq(s.rolePermissions.organizationId, o.organizationId));
  return rows
    .filter((r) => ["Admin", "Super Admin"].includes(r.role) || r.centreId === o.centreId)
    .map((r) => ({
      ...r,
      permissions: ["Admin", "Super Admin"].includes(r.role)
        ? [...permissions]
        : grants.filter((g) => g.role === r.role).map((g) => g.permission),
    }));
}
export async function person(tx: Database, o: Order, id: string, p: Permission) {
  if (
    !(await people(tx, o)).some(
      (r) => r.id === id && r.permissions.includes(p) && r.permissions.includes("orders.read"),
    )
  )
    fail("Select an active employee with the required branch permissions");
}
export function context(db: Database, settings: AuthSettings) {
  const access = (h: Headers, tx = db) => resolveAccess(tx, buildAuth(tx, settings), h);
  const scope = (a: Access) =>
    or(
      ...[...new Set(eligibleAssignments(a, "orders.read").map((x) => x.organizationId))].map(
        (id) => orderPredicate(a, id, "orders.read"),
      ),
    ) ?? sql`false`;
  async function read(tx: Database, a: Access, id: string) {
    const [o] = await tx
      .select({
        ...getTableColumns(s.orders),
        client: s.customers.name,
        company: s.organizations.name,
        companySlug: s.organizations.slug,
      })
      .from(s.orders)
      .innerJoin(s.leads, eq(s.orders.leadId, s.leads.id))
      .innerJoin(s.customers, eq(s.orders.customerId, s.customers.id))
      .innerJoin(s.organizations, eq(s.orders.organizationId, s.organizations.id))
      .where(and(eq(s.orders.id, z.uuid().parse(id)), eq(s.leads.outcome, "won"), scope(a)));
    if (!o) throw new AccessError(404, "Won order unavailable");
    if (
      !["orders.manage", "installations.manage", "audits.manage", "service.manage"].some((p) =>
        can(a, o, p as Permission),
      )
    )
      throw new AccessError(403);
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
  return { access, scope, read, transaction };
}
export async function event(
  tx: Database,
  a: Access,
  o: Order,
  id: string,
  action: string,
  notes: string,
  before: unknown,
  after: unknown,
) {
  const values = {
    organizationId: o.organizationId,
    orderId: o.id,
    entityId: id,
    actorId: a.user.id,
    action,
    notes,
    before: before ? snapshot(before) : null,
    after: snapshot(after),
  };
  await tx.insert(s.aftercareEvents).values(values);
  await tx.insert(s.auditLogs).values({
    organizationId: o.organizationId,
    actorId: a.user.id,
    targetId: id,
    action: `aftercare.${action}`,
    metadata: { orderId: o.id, before: values.before, after: values.after },
  });
}
export async function loadStatus(
  tx: Database,
  a: Access,
  o: Order,
  id: string,
  status: string,
  at: Date,
) {
  const [old] = await tx
    .select()
    .from(s.productionLoads)
    .where(and(eq(s.productionLoads.id, id), eq(s.productionLoads.orderId, o.id)));
  if (!old) fail("Load unavailable");
  const [next] = await tx
    .update(s.productionLoads)
    .set({
      status,
      version: old.version + 1,
      updatedAt: new Date(),
      ...(status === "completed" ? { completedAt: at } : {}),
      data: { ...old.data, [`${status}At`]: at.toISOString(), [`${status}By`]: a.user.id },
    })
    .where(eq(s.productionLoads.id, id))
    .returning();
  await tx.insert(s.productionLoadEvents).values({
    organizationId: o.organizationId,
    loadId: id,
    actorId: a.user.id,
    action: status,
    notes: "Recorded through installation and audit management",
    before: snapshot(old),
    after: snapshot(next),
  });
}
