import { and, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Database } from "../db";
import {
  auditLogs,
  centres,
  employeeProfiles,
  employeeRoleAssignments,
  organizations,
  rolePermissions,
  session,
  user,
} from "../db/schema";
import { buildAuth, type AuthSettings } from "../auth/config";
import {
  AccessError,
  adminOrganizations,
  requireAdmin,
  resolveAccess,
  targetAssignments,
  type Access,
} from "../auth/access";
import {
  createEmployeeSchema,
  employeeSchema,
  passwordSchema,
  permissionUpdateSchema,
  type EmployeeInput,
} from "../auth/validation";
import { z } from "zod";

export function employeeService(db: Database, settings: AuthSettings) {
  async function mutation<T>(
    headers: Headers,
    work: (tx: Database, access: Access, auth: ReturnType<typeof buildAuth>) => Promise<T>,
  ) {
    return db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;
      // Serializes privileged mutations with bootstrap, role changes and deactivation.
      await tx.execute(sql`select pg_advisory_xact_lock(73190021)`);
      const auth = buildAuth(tx, settings);
      const access = await resolveAccess(tx, auth, headers);
      return work(tx, access, auth);
    });
  }
  async function assignmentsAllowed(
    tx: Database,
    access: Access,
    assignments: EmployeeInput["assignments"],
  ) {
    for (const a of assignments) {
      requireAdmin(access, a.organizationId);
      if (!access.isSuperAdmin && ["Admin", "Super Admin"].includes(a.role))
        throw new AccessError(403);
      const [branch] = await tx
        .select()
        .from(centres)
        .where(
          and(
            eq(centres.id, a.centreId),
            eq(centres.organizationId, a.organizationId),
            eq(centres.active, true),
          ),
        );
      if (!branch)
        throw new AccessError(400, "Select an active branch in the correct organization");
    }
  }
  async function audit(
    tx: Database,
    access: Access,
    action: string,
    targetId: string,
    organizationIds: string[],
    metadata: Record<string, unknown> = {},
  ) {
    for (const organizationId of new Set(organizationIds))
      await tx
        .insert(auditLogs)
        .values({ actorId: access.user.id, action, targetId, organizationId, metadata });
  }
  return {
    createCentre(headers: Headers, input: unknown) {
      const data = z
        .object({ organizationId: z.uuid(), name: z.string().trim().min(2).max(100) })
        .parse(input);
      return mutation(headers, async (tx, access) => {
        requireAdmin(access, data.organizationId);
        const [centre] = await tx.insert(centres).values(data).returning();
        await audit(tx, access, "centre.created", centre.id, [data.organizationId]);
        return { id: centre.id };
      });
    },
    async list(headers: Headers) {
      const access = await resolveAccess(db, buildAuth(db, settings), headers);
      const orgIds = adminOrganizations(access);
      if (!orgIds.length) throw new AccessError(403);
      const candidates = await db
        .select()
        .from(employeeRoleAssignments)
        .where(inArray(employeeRoleAssignments.organizationId, orgIds));
      const ids = [...new Set(candidates.map((a) => a.userId))];
      const assignments = ids.length
        ? await db
            .select()
            .from(employeeRoleAssignments)
            .where(inArray(employeeRoleAssignments.userId, ids))
        : [];
      const allowedIds = ids.filter(
        (id) =>
          assignments
            .filter((a) => a.userId === id)
            .every(
              (a) =>
                orgIds.includes(a.organizationId) &&
                (access.isSuperAdmin || !["Super Admin", "Admin"].includes(a.role)),
            ) || id === access.user.id,
      );
      const employees = allowedIds.length
        ? await db
            .select({
              id: user.id,
              name: user.name,
              username: user.username,
              email: user.email,
              code: employeeProfiles.employeeCode,
              mobile: employeeProfiles.mobile,
              department: employeeProfiles.department,
              active: employeeProfiles.active,
              mustChangePassword: employeeProfiles.mustChangePassword,
              lastLoginAt: employeeProfiles.lastLoginAt,
            })
            .from(employeeProfiles)
            .innerJoin(user, eq(user.id, employeeProfiles.userId))
            .where(inArray(user.id, allowedIds))
            .orderBy(user.name)
        : [];
      return {
        employees: employees.map((e) => ({
          ...e,
          assignments: assignments.filter((a) => a.userId === e.id),
        })),
        organizations: await db
          .select()
          .from(organizations)
          .where(inArray(organizations.id, orgIds)),
        centres: await db.select().from(centres).where(inArray(centres.organizationId, orgIds)),
        permissions: await db
          .select()
          .from(rolePermissions)
          .where(inArray(rolePermissions.organizationId, orgIds)),
        isSuperAdmin: access.isSuperAdmin,
        currentUserId: access.user.id,
      };
    },
    create(headers: Headers, input: unknown) {
      const data = createEmployeeSchema.parse(input);
      return mutation(headers, async (tx, access, auth) => {
        await assignmentsAllowed(tx, access, data.assignments);
        const result = await auth.api.createUser({
          headers,
          body: {
            name: data.name,
            email: data.email,
            password: data.password,
            role: data.assignments.some((a) => ["Admin", "Super Admin"].includes(a.role))
              ? "admin"
              : "user",
            data: { username: data.username, displayUsername: data.username },
          },
        });
        const id = result.user.id;
        await tx.insert(employeeProfiles).values({
          userId: id,
          employeeCode: `SF-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
          mobile: data.mobile,
          department: data.department,
          active: data.active,
          mustChangePassword: false,
        });
        await tx
          .insert(employeeRoleAssignments)
          .values(data.assignments.map((a) => ({ ...a, userId: id })));
        if (!data.active)
          await auth.api.banUser({
            headers,
            body: { userId: id, banReason: "Access disabled by administrator" },
          });
        await audit(
          tx,
          access,
          "employee.created",
          id,
          data.assignments.map((a) => a.organizationId),
        );
        return { id };
      });
    },
    update(headers: Headers, id: string, input: unknown) {
      const data = employeeSchema.parse(input);
      return mutation(headers, async (tx, access, auth) => {
        const previous = await targetAssignments(tx, access, id);
        if (id === access.user.id)
          throw new AccessError(400, "Use another authorized administrator to modify your account");
        await assignmentsAllowed(tx, access, data.assignments);
        const [current] = await tx
          .select({ username: user.username })
          .from(user)
          .where(eq(user.id, id));
        await auth.api.adminUpdateUser({
          headers,
          body: {
            userId: id,
            data: {
              name: data.name,
              email: data.email,
              ...(current?.username !== data.username
                ? { username: data.username, displayUsername: data.username }
                : {}),
            },
          },
        });
        await auth.api.setRole({
          headers,
          body: {
            userId: id,
            role: data.assignments.some((a) => ["Admin", "Super Admin"].includes(a.role))
              ? "admin"
              : "user",
          },
        });
        await tx
          .update(employeeProfiles)
          .set({ mobile: data.mobile, department: data.department, active: data.active })
          .where(eq(employeeProfiles.userId, id));
        await tx.delete(employeeRoleAssignments).where(eq(employeeRoleAssignments.userId, id));
        await tx
          .insert(employeeRoleAssignments)
          .values(data.assignments.map((a) => ({ ...a, userId: id })));
        if (data.active) await auth.api.unbanUser({ headers, body: { userId: id } });
        else
          await auth.api.banUser({
            headers,
            body: { userId: id, banReason: "Access disabled by administrator" },
          });
        await tx.delete(session).where(eq(session.userId, id));
        await audit(
          tx,
          access,
          "employee.updated",
          id,
          [...previous, ...data.assignments].map((a) => a.organizationId),
        );
        return { id };
      });
    },
    action(
      headers: Headers,
      id: string,
      action: "activate" | "deactivate" | "reset-password" | "revoke-sessions",
      password?: string,
    ) {
      if (action === "reset-password") passwordSchema.parse(password);
      return mutation(headers, async (tx, access, auth) => {
        const previous = await targetAssignments(tx, access, id);
        if (id === access.user.id)
          throw new AccessError(400, "Use another authorized administrator to modify your account");
        if (action === "reset-password") {
          await auth.api.setUserPassword({ headers, body: { userId: id, newPassword: password! } });
          await tx
            .update(employeeProfiles)
            .set({ mustChangePassword: false })
            .where(eq(employeeProfiles.userId, id));
        }
        if (action === "activate" || action === "deactivate") {
          await tx
            .update(employeeProfiles)
            .set({ active: action === "activate" })
            .where(eq(employeeProfiles.userId, id));
          if (action === "activate") await auth.api.unbanUser({ headers, body: { userId: id } });
          else
            await auth.api.banUser({
              headers,
              body: { userId: id, banReason: "Access disabled by administrator" },
            });
        }
        await auth.api.revokeUserSessions({ headers, body: { userId: id } });
        await audit(
          tx,
          access,
          `employee.${action}`,
          id,
          previous.map((a) => a.organizationId),
        );
        return { id };
      });
    },
    updatePermissions(headers: Headers, input: unknown) {
      const data = permissionUpdateSchema.parse(input);
      return mutation(headers, async (tx, access) => {
        requireAdmin(access, data.organizationId);
        if (
          data.permissions.some((p) =>
            ["employees.manage", "permissions.manage", "settings.manage"].includes(p),
          )
        )
          throw new AccessError(400, "Administrative capabilities require an Admin role");
        await tx
          .delete(rolePermissions)
          .where(
            and(
              eq(rolePermissions.organizationId, data.organizationId),
              eq(rolePermissions.role, data.role),
            ),
          );
        if (data.permissions.length)
          await tx.insert(rolePermissions).values(
            [...new Set(data.permissions)].map((permission) => ({
              organizationId: data.organizationId,
              role: data.role,
              permission,
            })),
          );
        await audit(tx, access, "role.permissions-updated", data.role, [data.organizationId], {
          permissions: [...new Set(data.permissions)],
        });
        return { role: data.role };
      });
    },
  };
}
