import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../db";
import { AccessError } from "../auth/access";
import { adminCatalog, documents, orderStages } from "../db/schema";
export async function newBusinessAllowed(
  db: Database,
  organizationId: string,
  territory: string,
  newLead = true,
) {
  const rows = await db
    .select()
    .from(adminCatalog)
    .where(
      and(
        eq(adminCatalog.organizationId, organizationId),
        sql`${adminCatalog.kind} in ('territory','company_profile')`,
      ),
    );
  if (newLead && rows.some((r) => r.kind === "company_profile" && !r.active))
    throw new AccessError(409, "New leads are disabled for this company");
  const territories = rows.filter((r) => r.kind === "territory");
  if (territory && territories.length && !territories.some((r) => r.active && r.name === territory))
    throw new AccessError(400, "Choose an active company territory");
}
export async function requiredDocuments(
  db: Database,
  orderId: string,
  organizationId: string,
  stageNumber: number,
) {
  const [stage] = await db
    .select()
    .from(orderStages)
    .where(
      and(
        eq(orderStages.orderId, orderId),
        eq(orderStages.organizationId, organizationId),
        eq(orderStages.number, stageNumber),
      ),
    );
  const requirements = stage?.documentRequirements ?? [];
  if (!requirements.length) return;
  const files = await db
    .select({ requirementId: documents.requirementId })
    .from(documents)
    .where(and(eq(documents.orderId, orderId), eq(documents.stageNumber, stageNumber)));
  if (requirements.some((r) => !files.some((f) => f.requirementId === r.id)))
    throw new AccessError(400, "Upload every active company document requirement for this stage");
}
