import { and, eq, exists, inArray, notExists, or, sql, type SQL } from "drizzle-orm";
import { type Access, AccessError } from "../auth/access";
import { customers, leads, projects } from "../db/schema";
import type { Permission } from "../auth/roles";
import type { Database } from "../db";

export function eligibleAssignments(access: Access, permission: Permission) {
  return access.assignments.filter(
    (a) =>
      ["Admin", "Super Admin"].includes(a.role) ||
      access.grants.some(
        (g) =>
          g.organizationId === a.organizationId && g.role === a.role && g.permission === permission,
      ),
  );
}
export function canCoordinate(access: Access, organizationId: string, centreId: string) {
  return eligibleAssignments(access, "leads.write").some(
    (a) =>
      a.organizationId === organizationId &&
      (["Admin", "Super Admin"].includes(a.role) ||
        (a.centreId === centreId && ["CSE", "Sales Manager"].includes(a.role))),
  );
}
export function leadScope(access: Access, permission: Permission = "leads.read"): SQL {
  const scopes = eligibleAssignments(access, permission).map((a) =>
    and(
      eq(leads.organizationId, a.organizationId),
      ["Super Admin", "Admin"].includes(a.role)
        ? undefined
        : and(
            eq(leads.centreId, a.centreId),
            ["CSE", "Sales Manager"].includes(a.role)
              ? undefined
              : eq(leads.assignedTo, access.user.id),
          ),
    ),
  );
  return or(...scopes) ?? sql`false`;
}
export function organizationAllowed(
  access: Access,
  id: string,
  permission: Permission = "leads.read",
) {
  if (!eligibleAssignments(access, permission).some((a) => a.organizationId === id))
    throw new AccessError(403);
}
export function customerScope(db: Database, access: Access) {
  const broad = eligibleAssignments(access, "leads.read")
    .filter((a) => ["Admin", "Super Admin"].includes(a.role))
    .map((a) => a.organizationId);
  const orgs = eligibleAssignments(access, "leads.read").map((a) => a.organizationId);
  return and(
    inArray(customers.organizationId, orgs),
    or(
      broad.length ? inArray(customers.organizationId, broad) : undefined,
      or(
        ...eligibleAssignments(access, "leads.read").map((a) =>
          and(
            eq(customers.organizationId, a.organizationId),
            eq(customers.centreId, a.centreId),
            ["CSE", "Sales Manager"].includes(a.role)
              ? undefined
              : and(
                  eq(customers.assignedTo, access.user.id),
                  notExists(
                    db
                      .select({ id: leads.id })
                      .from(leads)
                      .where(
                        and(
                          eq(leads.customerId, customers.id),
                          eq(leads.organizationId, customers.organizationId),
                        ),
                      ),
                  ),
                ),
          ),
        ),
      ),
      exists(
        db
          .select({ id: leads.id })
          .from(leads)
          .where(
            and(
              eq(leads.customerId, customers.id),
              eq(leads.organizationId, customers.organizationId),
              leadScope(access),
            ),
          ),
      ),
    ),
  );
}
export function projectScope(db: Database, access: Access) {
  return (
    or(
      ...eligibleAssignments(access, "leads.read").map((a) =>
        and(
          eq(projects.organizationId, a.organizationId),
          ["Admin", "Super Admin"].includes(a.role)
            ? undefined
            : and(
                eq(projects.centreId, a.centreId),
                ["CSE", "Sales Manager"].includes(a.role)
                  ? undefined
                  : and(
                      eq(projects.assignedTo, access.user.id),
                      notExists(
                        db
                          .select({ id: leads.id })
                          .from(leads)
                          .where(
                            and(
                              eq(leads.projectId, projects.id),
                              eq(leads.organizationId, projects.organizationId),
                            ),
                          ),
                      ),
                    ),
              ),
        ),
      ),
      exists(
        db
          .select({ id: leads.id })
          .from(leads)
          .where(
            and(
              eq(leads.projectId, projects.id),
              eq(leads.organizationId, projects.organizationId),
              leadScope(access),
            ),
          ),
      ),
    ) ?? sql`false`
  );
}
