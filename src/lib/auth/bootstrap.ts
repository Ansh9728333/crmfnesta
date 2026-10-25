import { sql } from "drizzle-orm";
import type { Database } from "../db";
import {
  auditLogs,
  centres,
  employeeProfiles,
  employeeRoleAssignments,
  organizations,
  rolePermissions,
  user,
} from "../db/schema";
import { companies } from "../domain/workflows";
import { buildAuth, type AuthSettings } from "./config";
import { defaults, roles } from "./roles";
import { createEmployeeSchema } from "./validation";

export async function bootstrapAdmin(
  db: Database,
  settings: AuthSettings,
  input: {
    name: string;
    email: string;
    username: string;
    password: string;
    mobile: string;
    centre: string;
  },
) {
  // Reuse provisioning validation, with assignments supplied only after branch creation.
  const fields = createEmployeeSchema
    .omit({ assignments: true })
    .parse({ ...input, department: "Administration", active: true });
  if (!input.centre.trim()) throw new Error("BOOTSTRAP_CENTRE is required");
  return db.transaction(async (transaction) => {
    const tx = transaction as unknown as Database;
    await tx.execute(sql`select pg_advisory_xact_lock(73190021)`);
    const existing = await tx.select({ id: user.id }).from(user).limit(1);
    if (existing.length)
      throw new Error("Bootstrap is permanently closed once any authentication user exists");
    const auth = buildAuth(tx, settings);
    // Supported Admin server API permits trusted server calls with no request headers.
    const created = await auth.api.createUser({
      body: {
        name: fields.name,
        email: fields.email,
        password: fields.password,
        role: "admin",
        data: { username: fields.username, displayUsername: fields.username },
      },
    });
    await tx.insert(employeeProfiles).values({
      userId: created.user.id,
      employeeCode: "SF-000001",
      mobile: fields.mobile,
      department: "Administration",
      mustChangePassword: true,
    });
    for (const company of companies) {
      const [org] = await tx
        .insert(organizations)
        .values({ slug: company.id, name: company.name, product: company.product })
        .onConflictDoUpdate({ target: organizations.slug, set: { name: company.name } })
        .returning();
      const [centre] = await tx
        .insert(centres)
        .values({ organizationId: org.id, name: input.centre.trim() })
        .returning();
      await tx.insert(employeeRoleAssignments).values({
        userId: created.user.id,
        organizationId: org.id,
        centreId: centre.id,
        role: "Super Admin",
      });
      for (const role of roles) {
        if (defaults[role].length)
          await tx
            .insert(rolePermissions)
            .values(
              defaults[role].map((permission) => ({ organizationId: org.id, role, permission })),
            );
      }
      await tx.insert(auditLogs).values({
        actorId: created.user.id,
        organizationId: org.id,
        targetId: created.user.id,
        action: "bootstrap.completed",
      });
    }
    return { id: created.user.id };
  });
}
