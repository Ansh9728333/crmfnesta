import { and, eq, isNull, or, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import type { Access } from "../auth/access";
import { AccessError, orderPredicate } from "../auth/access";
import { eligibleAssignments, leadScope } from "../leads/access";
import { leads, orders } from "../db/schema";
import type { Permission } from "../auth/roles";
import { dateBound, type Filters } from "./validation";
export function reportAccess(a: Access) {
  const assignments = eligibleAssignments(a, "reports.read");
  if (!assignments.length) throw new AccessError(403, "Reports permission is required");
  return { ...a, assignments };
}
export function moduleAccess(a: Access, p: Permission) {
  return { ...a, assignments: eligibleAssignments(a, p) };
}
export function orderScope(a: Access) {
  return (
    or(
      ...[...new Set(eligibleAssignments(a, "orders.read").map((x) => x.organizationId))].map(
        (id) => orderPredicate(a, id, "orders.read"),
      ),
    ) ?? sql`false`
  );
}
export function dates(column: SQLWrapper, f: Filters) {
  return and(
    f.from ? sql`${column} >= ${dateBound(f.from).toISOString()}::timestamptz` : undefined,
    f.to ? sql`${column} < ${dateBound(f.to, true).toISOString()}::timestamptz` : undefined,
  );
}
export function leadFilters(f: Filters) {
  return and(
    isNull(leads.archivedAt),
    f.organizationId ? eq(leads.organizationId, f.organizationId) : undefined,
    f.financialYear ? eq(leads.financialYear, f.financialYear) : undefined,
    f.territory ? eq(leads.territory, f.territory) : undefined,
    f.executiveId ? eq(leads.assignedTo, f.executiveId) : undefined,
  );
}
export function leadWhere(a: Access, f: Filters, withDates = true) {
  return (
    and(
      leadScope(a),
      leadFilters(f),
      withDates ? dates(leads.createdAt, f) : undefined,
      f.status === "active"
        ? isNull(leads.outcome)
        : ["won", "lost"].includes(f.status)
          ? eq(leads.outcome, f.status)
          : f.status
            ? sql`false`
            : undefined,
    ) ?? sql`false`
  );
}
export function orderWhere(a: Access, f: Filters, withDates = true) {
  return (
    and(
      orderScope(a),
      leadFilters(f),
      eq(leads.outcome, "won"),
      withDates ? dates(orders.createdAt, f) : undefined,
      f.status === "lost"
        ? sql`false`
        : f.status === "completed"
          ? sql`${orders.completedAt} is not null`
          : f.status === "active"
            ? isNull(orders.completedAt)
            : undefined,
    ) ?? sql`false`
  );
}
export const literalStatus = (f: Filters, column: SQL) =>
  ["", "active", "won", "lost", "completed"].includes(f.status) ? undefined : eq(column, f.status);
export const grace = (target: string, org: SQL) =>
  sql`coalesce((select (c.config->>'graceHours')::int from admin_catalog c where c.organization_id=${org} and c.kind='sla' and c.active and c.code=${target} limit 1),0)*interval '1 hour'`;
