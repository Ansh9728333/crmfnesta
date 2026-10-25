import { requiredDocuments } from "../management/policies";
import { AccessError } from "../auth/access";
import { eq } from "drizzle-orm";
import Decimal from "decimal.js";
import type { Database } from "../db";
import {
  installations,
  sgripGlassChecklists,
  productionLoads,
  productionLoadItems,
  orderItems,
  engineerAudits,
  handovers,
  aftercareFiles,
  customerFeedback,
} from "../db/schema";
import { handoverDocumentKinds } from "./validation";
export async function assertInstalled(tx: Database, id: string) {
  const [i] = await tx.select().from(installations).where(eq(installations.id, id));
  if (!i || i.status !== "completed" || !i.loadId)
    throw new AccessError(400, "Complete installation for every load first");
  const lines = await tx
    .select()
    .from(productionLoadItems)
    .where(eq(productionLoadItems.loadId, i.loadId));
  if (!lines.length || lines.some((l) => !new Decimal(l.quantity).eq(l.installedQuantity)))
    throw new AccessError(400, "Installed quantities are incomplete");
  const [g] = await tx
    .select()
    .from(sgripGlassChecklists)
    .where(eq(sgripGlassChecklists.installationId, id));
  if (g?.glassRequired && (!g.templateApproved || !g.approvedBy || !g.templateFileId))
    throw new AccessError(400, "Complete the required S-Grip glass checklist");
  return i;
}
export async function aftercareOrderState(tx: Database, id: string) {
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, id));
  const loads = await tx.select().from(productionLoads).where(eq(productionLoads.orderId, id));
  const applicable = [];
  for (const load of loads) {
    const [line] = await tx
      .select({ id: productionLoadItems.id })
      .from(productionLoadItems)
      .where(eq(productionLoadItems.loadId, load.id))
      .limit(1);
    if (line) applicable.push(load);
  }
  const installationRows = await tx
    .select()
    .from(installations)
    .where(eq(installations.orderId, id));
  return { items, loads: applicable, installationRows };
}
export async function assertHandoverReady(tx: Database, id: string) {
  const state = await aftercareOrderState(tx, id);
  if (state.loads[0]) await requiredDocuments(tx, id, state.loads[0].organizationId, 15);
  if (
    !state.items.length ||
    state.items.some((i) => !new Decimal(i.quantity).eq(i.allocatedQuantity)) ||
    !state.loads.length ||
    state.loads.some((l) => l.status !== "completed")
  )
    throw new AccessError(
      400,
      "All confirmed quantities must be allocated and all loads completed",
    );
  for (const l of state.loads) {
    const i = state.installationRows.find((i) => i.loadId === l.id);
    if (!i) throw new AccessError(400, "Installation record required");
    await assertInstalled(tx, i.id);
    const [a] = await tx
      .select()
      .from(engineerAudits)
      .where(eq(engineerAudits.installationId, i.id));
    if (a?.status !== "approved" || !a.approvedBy)
      throw new AccessError(400, "Approved engineer audits required");
  }
  const [handover] = await tx.select().from(handovers).where(eq(handovers.orderId, id));
  const files = await tx.select().from(aftercareFiles).where(eq(aftercareFiles.orderId, id));
  if (
    !handover ||
    handoverDocumentKinds.some(
      (kind) => !files.some((f) => f.handoverId === handover.id && f.kind === kind),
    )
  )
    throw new AccessError(
      400,
      "Upload the handover certificate, installation report and warranty document",
    );
  return { state, handover };
}
export async function assertAftercareStage(tx: Database, id: string, n: number) {
  if (n < 12) return;
  const s = await aftercareOrderState(tx, id);
  if (!s.loads.length) throw new AccessError(400, "Production loads required");
  for (const l of s.loads) {
    const i = s.installationRows.find((i) => i.loadId === l.id);
    if (!i?.startedAt)
      throw new AccessError(400, "Start each load installation in Installation Management");
    if (n >= 13) await assertInstalled(tx, i.id);
    if (n >= 14) {
      const [a] = await tx
        .select()
        .from(engineerAudits)
        .where(eq(engineerAudits.installationId, i.id));
      if (a?.status !== "approved" || !a.approvedBy)
        throw new AccessError(400, "Approved engineer audits required");
    }
  }
  if (n >= 15) {
    const { handover } = await assertHandoverReady(tx, id);
    if (handover.status !== "confirmed" || !handover.customerAccepted)
      throw new AccessError(400, "Record customer acceptance and confirm handover first");
  }
  if (n === 16) {
    const [f] = await tx.select().from(customerFeedback).where(eq(customerFeedback.orderId, id));
    if (!f || f.status === "pending" || (!f.googleRequestedAt && !f.testimonialRequestedAt))
      throw new AccessError(
        400,
        "Record the feedback request and outcome; a positive review is never required",
      );
  }
}
