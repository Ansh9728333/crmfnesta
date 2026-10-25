import { and, eq } from "drizzle-orm";
import type { Database } from "../db";
import {
  auditLogs,
  adminCatalog,
  leads,
  orderStageEvents,
  orderStagePolicies,
  orderStages,
  orders,
} from "../db/schema";
import { AccessError } from "../auth/access";
import { stageDefinitions } from "./definitions";
export async function initializeOrderStages(
  tx: Database,
  order: typeof orders.$inferSelect,
  actorId: string,
) {
  const existing = await tx
    .select({ id: orderStages.id })
    .from(orderStages)
    .where(eq(orderStages.orderId, order.id));
  if (existing.length === 16) return;
  if (existing.length || order.stage !== 1)
    throw new AccessError(409, "Existing workflow progress needs review before initialization");
  const [lead] = await tx
    .select()
    .from(leads)
    .where(and(eq(leads.id, order.leadId), eq(leads.organizationId, order.organizationId)));
  if (lead?.outcome !== "won" || !order.quotationId)
    throw new AccessError(409, "Post-sales requires a quotation-backed Won conversion");
  const policies = await tx
    .select()
    .from(orderStagePolicies)
    .where(eq(orderStagePolicies.organizationId, order.organizationId));
  const requirements = await tx
    .select()
    .from(adminCatalog)
    .where(
      and(
        eq(adminCatalog.organizationId, order.organizationId),
        eq(adminCatalog.kind, "document_requirement"),
        eq(adminCatalog.active, true),
      ),
    );
  const stages = await tx
    .insert(orderStages)
    .values(
      stageDefinitions.map((def) => {
        const policy = policies.find((p) => p.number === def.number);
        return {
          organizationId: order.organizationId,
          orderId: order.id,
          number: def.number,
          name: def.name,
          ownerRole: policy?.ownerRole ?? def.ownerRole,
          approverRole: policy?.approverRole ?? def.approverRole,
          requiredFields: policy?.requiredFields ?? def.requiredFields,
          documentRequirements: requirements
            .filter((r) => Number(r.config.stageNumber) === def.number)
            .map((r) => ({ id: r.id, name: r.name })),
        };
      }),
    )
    .returning();
  await tx.insert(orderStageEvents).values(
    stages.map((s) => ({
      organizationId: s.organizationId,
      orderId: s.orderId,
      stageId: s.id,
      actorId,
      action: "initialized",
      after: JSON.parse(JSON.stringify(s)) as Record<string, unknown>,
    })),
  );
  await tx.insert(auditLogs).values({
    organizationId: order.organizationId,
    actorId,
    targetId: order.id,
    action: "order.workflow-initialized",
    metadata: { stages: 16 },
  });
}
