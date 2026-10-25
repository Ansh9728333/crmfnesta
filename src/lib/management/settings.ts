import { and, asc, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db";
import { buildAuth, type AuthSettings } from "../auth/config";
import { AccessError, adminOrganizations, requireAdmin, resolveAccess } from "../auth/access";
import { adminCatalog, auditLogs, organizations } from "../db/schema";
import { catalogConfig, catalogKinds, catalogSchema } from "./validation";
export function settingsService(db: Database, settings: AuthSettings) {
  const access = (h: Headers, tx = db) => resolveAccess(tx, buildAuth(tx, settings), h);
  return {
    async list(h: Headers, raw: unknown = {}) {
      const a = await access(h),
        ids = adminOrganizations(a);
      if (!ids.length) throw new AccessError(403, "Only company administrators manage settings");
      const f = z
        .object({
          organizationId: z.union([z.uuid(), z.literal("")]).default(""),
          kind: z.enum(catalogKinds).default("territory"),
          page: z.coerce.number().int().min(1).max(100000).default(1),
        })
        .parse(raw);
      if (f.organizationId) requireAdmin(a, f.organizationId);
      const where = and(
        inArray(adminCatalog.organizationId, ids),
        f.organizationId ? eq(adminCatalog.organizationId, f.organizationId) : undefined,
        eq(adminCatalog.kind, f.kind),
      );
      const [{ total }] = await db.select({ total: count() }).from(adminCatalog).where(where);
      return {
        rows: await db
          .select()
          .from(adminCatalog)
          .where(where)
          .orderBy(asc(adminCatalog.name), desc(adminCatalog.id))
          .limit(20)
          .offset((f.page - 1) * 20),
        total,
        filters: f,
        companies: await db.select().from(organizations).where(inArray(organizations.id, ids)),
        currentUserId: a.user.id,
      };
    },
    async save(h: Headers, raw: unknown) {
      const input = catalogSchema.parse(raw),
        data = catalogConfig.parse(raw);
      return db.transaction(async (t) => {
        const tx = t as unknown as Database;
        await tx.execute(sql`select pg_advisory_xact_lock(73190021)`);
        const a = await access(h, tx);
        requireAdmin(a, input.organizationId);
        const [company] = await tx
          .select()
          .from(organizations)
          .where(eq(organizations.id, input.organizationId));
        if (!company) throw new AccessError(404);
        const [old] = input.id
          ? await tx
              .select()
              .from(adminCatalog)
              .where(
                and(
                  eq(adminCatalog.id, input.id),
                  eq(adminCatalog.organizationId, input.organizationId),
                ),
              )
          : [];
        if (input.id && !old) throw new AccessError(404);
        if ((old?.version ?? 0) !== input.version)
          throw new AccessError(409, "Setting changed. Reload before saving");
        if (old && (old.kind !== data.kind || old.code !== input.code))
          throw new AccessError(409, "Configuration identity cannot change");
        if (
          data.kind === "company_profile" &&
          (input.code !== company.slug || input.name !== company.name)
        )
          throw new AccessError(
            400,
            "The three canonical company names and codes must be preserved",
          );
        if (data.kind === "sla" && input.code !== data.config.target)
          throw new AccessError(400, "SLA code must match its target");
        const duplicate = await tx
          .select({ id: adminCatalog.id })
          .from(adminCatalog)
          .where(
            and(
              eq(adminCatalog.organizationId, input.organizationId),
              eq(adminCatalog.kind, data.kind),
              or(
                eq(adminCatalog.code, input.code),
                sql`lower(${adminCatalog.name})=lower(${input.name})`,
              ),
            ),
          );
        if (duplicate.some((d) => d.id !== old?.id))
          throw new AccessError(409, "A setting with this code or name already exists");
        const values = {
          organizationId: input.organizationId,
          kind: data.kind,
          code: input.code,
          name: input.name,
          active: input.active,
          config: data.config,
          version: (old?.version ?? 0) + 1,
          changedBy: a.user.id,
          updatedAt: new Date(),
        };
        const [next] = old
          ? await tx.update(adminCatalog).set(values).where(eq(adminCatalog.id, old.id)).returning()
          : await tx.insert(adminCatalog).values(values).returning();
        await tx.insert(auditLogs).values({
          organizationId: next.organizationId,
          actorId: a.user.id,
          targetId: next.id,
          action: "setting.saved",
          metadata: {
            notes: input.notes,
            before: old ? JSON.parse(JSON.stringify(old)) : null,
            after: JSON.parse(JSON.stringify(next)),
          },
        });
        return { id: next.id };
      });
    },
  };
}
