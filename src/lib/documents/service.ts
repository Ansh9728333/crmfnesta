import { and, eq } from "drizzle-orm";
import type { Database } from "../db";
import { auditLogs, documents, orders } from "../db/schema";
import type { Auth } from "../auth/config";
import { AccessError, orderPredicate, requirePermission, resolveAccess } from "../auth/access";

export async function authorizedDocument(
  db: Database,
  auth: Auth,
  headers: Headers,
  documentId: string,
  sign: (path: string) => Promise<string>,
) {
  const access = await resolveAccess(db, auth, headers);
  // Iterate only verified organization assignments; do not look up the object globally.
  for (const organizationId of new Set(access.assignments.map((a) => a.organizationId))) {
    try {
      requirePermission(access, organizationId, "documents.read");
    } catch {
      continue;
    }
    const [record] = await db
      .select({ document: documents })
      .from(documents)
      .innerJoin(
        orders,
        and(eq(documents.orderId, orders.id), eq(documents.organizationId, orders.organizationId)),
      )
      .where(
        and(
          eq(documents.id, documentId),
          eq(documents.organizationId, organizationId),
          orderPredicate(access, organizationId, "documents.read"),
        ),
      );
    if (!record) continue;
    if (!record.document.objectPath.startsWith(`${organizationId}/${record.document.orderId}/`))
      throw new AccessError(403);
    const url = await sign(record.document.objectPath);
    await db.insert(auditLogs).values({
      actorId: access.user.id,
      organizationId,
      targetId: documentId,
      action: "document.download-authorized",
    });
    return { url, expiresIn: 60 };
  }
  throw new AccessError(404, "Document unavailable");
}
