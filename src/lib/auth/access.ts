import { and, eq, inArray, or, sql, getTableColumns } from "drizzle-orm";
import type { Database } from "../db";
import {
  employeeProfiles,
  employeeRoleAssignments,
  rolePermissions,
  orders as orderTable,
  orderStages,
  productionLoads,
  installations,
  engineerAudits,
  serviceTickets,
  centres,
} from "../db/schema";
import type { Auth } from "./config";
import { permissions, type Permission } from "./roles";

export class AccessError extends Error {
  constructor(
    public status: number,
    message = "Access denied",
  ) {
    super(message);
  }
}
export async function resolveAccess(
  db: Database,
  auth: Auth,
  headers: Headers,
  allowPasswordChange = false,
) {
  const session = await auth.api.getSession({ headers, query: { disableCookieCache: true } });
  if (!session) throw new AccessError(401, "Please sign in");
  const [profile] = await db
    .select()
    .from(employeeProfiles)
    .where(eq(employeeProfiles.userId, session.user.id));
  if (!profile?.active || session.user.banned)
    throw new AccessError(403, "Access is disabled. Contact your administrator.");
  if (profile.mustChangePassword && !allowPasswordChange)
    throw new AccessError(428, "Change your password before continuing");
  const assignments = await db
    .select(getTableColumns(employeeRoleAssignments))
    .from(employeeRoleAssignments)
    .innerJoin(centres, eq(centres.id, employeeRoleAssignments.centreId))
    .where(and(eq(employeeRoleAssignments.userId, session.user.id), eq(centres.active, true)));
  if (!assignments.length) throw new AccessError(403);
  const isSuperAdmin = assignments.some((a) => a.role === "Super Admin");
  const grants = await db
    .select()
    .from(rolePermissions)
    .where(
      inArray(rolePermissions.organizationId, [
        ...new Set(assignments.map((a) => a.organizationId)),
      ]),
    );
  return {
    user: session.user,
    profile,
    assignments,
    isSuperAdmin,
    grants,
    session: session.session,
  };
}
export type Access = Awaited<ReturnType<typeof resolveAccess>>;
export function hasPermission(access: Access, organizationId: string, permission: Permission) {
  return access.assignments.some(
    (a) =>
      a.organizationId === organizationId &&
      (a.role === "Super Admin" ||
        a.role === "Admin" ||
        access.grants.some(
          (g) =>
            g.organizationId === organizationId && g.role === a.role && g.permission === permission,
        )),
  );
}
export function requirePermission(access: Access, organizationId: string, permission: Permission) {
  if (!hasPermission(access, organizationId, permission)) throw new AccessError(403);
}
export function adminOrganizations(access: Access) {
  return [
    ...new Set(
      access.assignments
        .filter((a) => a.role === "Super Admin" || a.role === "Admin")
        .map((a) => a.organizationId),
    ),
  ];
}
export function requireAdmin(access: Access, organizationId: string) {
  if (!adminOrganizations(access).includes(organizationId)) throw new AccessError(403);
}
export function accessiblePermissions(access: Access) {
  return permissions.filter((p) =>
    access.assignments.some((a) => hasPermission(access, a.organizationId, p)),
  );
}
export async function targetAssignments(db: Database, access: Access, userId: string) {
  const target = await db
    .select()
    .from(employeeRoleAssignments)
    .where(eq(employeeRoleAssignments.userId, userId));
  if (
    !target.length ||
    target.some(
      (a) =>
        !adminOrganizations(access).includes(a.organizationId) ||
        (!access.isSuperAdmin && ["Admin", "Super Admin"].includes(a.role)),
    )
  )
    throw new AccessError(403);
  return target;
}
export function assignedOrderScope(access: Access, organizationId: string, permission: Permission) {
  requirePermission(access, organizationId, permission);
  const eligible = access.assignments.filter(
    (a) =>
      a.organizationId === organizationId &&
      (["Super Admin", "Admin"].includes(a.role) ||
        access.grants.some(
          (g) =>
            g.organizationId === organizationId && g.role === a.role && g.permission === permission,
        )),
  );
  return {
    organizationId,
    broad: eligible.some((a) => ["Super Admin", "Admin"].includes(a.role)),
    managerCentreIds: eligible
      .filter((a) => ["Sales Manager", "Post-Sales Coordinator"].includes(a.role))
      .map((a) => a.centreId),
    assignedCentreIds: eligible.map((a) => a.centreId),
    reviewerAssignments: eligible,
  };
}
// Queries must use this predicate, including privileged connections that bypass RLS.
export function orderPredicate(access: Access, organizationId: string, permission: Permission) {
  const scope = assignedOrderScope(access, organizationId, permission);
  return and(
    eq(orderTable.organizationId, scope.organizationId),
    scope.broad
      ? undefined
      : or(
          scope.managerCentreIds.length
            ? inArray(orderTable.centreId, scope.managerCentreIds)
            : undefined,
          and(
            or(
              eq(orderTable.assignedTo, access.user.id),
              sql`exists(select 1 from ${installations} where ${installations.orderId}=${orderTable.id} and ${installations.organizationId}=${orderTable.organizationId} and (${installations.assignedTo}=${access.user.id} or ${installations.teamMembers} ? ${access.user.id}))`,
              sql`exists(select 1 from ${engineerAudits} where ${engineerAudits.orderId}=${orderTable.id} and ${engineerAudits.organizationId}=${orderTable.organizationId} and ${engineerAudits.engineerId}=${access.user.id})`,
              sql`exists(select 1 from ${serviceTickets} where ${serviceTickets.orderId}=${orderTable.id} and ${serviceTickets.organizationId}=${orderTable.organizationId} and ${serviceTickets.assignedTo}=${access.user.id})`,
              sql`exists(select 1 from ${productionLoads} where ${productionLoads.orderId}=${orderTable.id} and ${productionLoads.organizationId}=${orderTable.organizationId} and ${productionLoads.assignedTo}=${access.user.id})`,
              sql`exists(select 1 from ${orderStages} where ${orderStages.orderId}=${orderTable.id} and ${orderStages.organizationId}=${orderTable.organizationId} and (${or(eq(orderStages.assignedTo, access.user.id), eq(orderStages.approvedBy, access.user.id), and(eq(orderStages.status, "awaiting_approval"), or(...scope.reviewerAssignments.map((a) => and(eq(orderTable.centreId, a.centreId), eq(orderStages.approverRole, a.role))))))}))`,
            ),
            inArray(orderTable.centreId, scope.assignedCentreIds),
          ),
        ),
  );
}
