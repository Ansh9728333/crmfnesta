import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db";
import type { Access } from "../auth/access";
import * as s from "../db/schema";
import { aftercareActionSchema } from "./validation";
import { actual, assigned, can, fail, need, person, stale, type Order } from "./context";
import { assertHandoverReady } from "./gates";
type Input = z.infer<typeof aftercareActionSchema>;
export async function closureCommand(tx: Database, a: Access, o: Order, input: Input) {
  const [h] = await tx.select().from(s.handovers).where(eq(s.handovers.orderId, o.id));
  const base = { organizationId: o.organizationId, orderId: o.id };
  if (input.action === "handover.prepare") {
    need(a, o, "orders.manage");
    if (h) return { before: h, after: h, retry: true };
    const [next] = await tx
      .insert(s.handovers)
      .values({ ...base, notes: input.notes })
      .returning();
    return { before: null, after: next };
  }
  if (input.action === "handover.confirm") {
    need(a, o, "orders.manage");
    if (!h || h.id !== input.id || h.status !== "draft") fail("Draft handover required");
    stale(h.version, input.version);
    const { state } = await assertHandoverReady(tx, o.id);
    const stages = await tx.select().from(s.orderStages).where(eq(s.orderStages.orderId, o.id));
    if (
      o.stage !== 15 ||
      !Array.from({ length: 14 }, (_, i) => i + 1).every((n) =>
        stages.some((s) => s.number === n && s.status === "completed" && s.approvedBy),
      )
    )
      fail("Complete the first fourteen workflow stages before handover");
    const at = actual(
      input.occurredAt,
      new Date(Math.max(...state.loads.map((l) => l.completedAt?.getTime() ?? Infinity))),
    );
    const [next] = await tx
      .update(s.handovers)
      .set({
        status: "confirmed",
        completedAt: at,
        customerAccepted: true,
        customerRepresentative: input.customerRepresentative,
        acceptanceReference: input.acceptanceReference,
        confirmedBy: a.user.id,
        confirmedAt: new Date(),
        notes: input.notes,
        version: h.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(s.handovers.id, h.id))
      .returning();
    return { before: h, after: next };
  }
  if (input.action !== "feedback.save" && !input.action.startsWith("ticket.")) return;
  if (h?.status !== "confirmed" || !h.completedAt)
    fail("Confirm site handover before feedback or service requests");
  if (input.action === "feedback.save") {
    need(a, o, "orders.manage");
    const [old] = await tx
      .select()
      .from(s.customerFeedback)
      .where(eq(s.customerFeedback.orderId, o.id));
    stale(old?.version ?? 0, input.version);
    const google = input.googleRequestedAt
        ? actual(input.googleRequestedAt, h.completedAt)
        : (old?.googleRequestedAt ?? null),
      testimonial = input.testimonialRequestedAt
        ? actual(input.testimonialRequestedAt, h.completedAt)
        : (old?.testimonialRequestedAt ?? null);
    if (
      (old?.googleRequestedAt && google?.getTime() !== old.googleRequestedAt.getTime()) ||
      (old?.testimonialRequestedAt &&
        testimonial?.getTime() !== old.testimonialRequestedAt.getTime())
    )
      fail("Recorded request dates are immutable");
    if (input.status !== "pending" && !google && !testimonial)
      fail("Record a review or testimonial request date");
    if (input.status === "received" && !input.receivedAt) fail("Record the feedback received date");
    const received = input.receivedAt
      ? actual(
          input.receivedAt,
          new Date(
            Math.max(h.completedAt.getTime(), google?.getTime() ?? 0, testimonial?.getTime() ?? 0),
          ),
        )
      : null;
    const values = {
      googleRequestedAt: google,
      testimonialRequestedAt: testimonial,
      status: input.status,
      receivedAt: received,
      comments: input.comments,
      testimonial: input.testimonial ?? null,
      reviewUrl: input.reviewUrl || null,
      rating: input.rating ?? null,
      publicationConsent: input.publicationConsent,
      recordedBy: a.user.id,
      version: (old?.version ?? 0) + 1,
      updatedAt: new Date(),
    };
    const [next] = old
      ? await tx
          .update(s.customerFeedback)
          .set(values)
          .where(eq(s.customerFeedback.id, old.id))
          .returning()
      : await tx
          .insert(s.customerFeedback)
          .values({ ...base, ...values })
          .returning();
    return { before: old, after: next };
  }
  need(a, o, "service.manage");
  if (input.action === "ticket.create") {
    need(a, o, "orders.manage");
    await person(tx, o, input.assignedTo, "service.manage");
    const [next] = await tx
      .insert(s.serviceTickets)
      .values({
        ...base,
        title: input.title,
        description: input.description,
        kind: input.kind,
        assignedTo: input.assignedTo,
        priority: input.priority,
        dueAt: new Date(input.dueAt),
      })
      .returning();
    return { before: null, after: next };
  }
  if (input.action !== "ticket.assign" && input.action !== "ticket.status") return;
  const [t] = await tx
    .select()
    .from(s.serviceTickets)
    .where(and(eq(s.serviceTickets.id, input.id), eq(s.serviceTickets.orderId, o.id)));
  if (!t) fail("Service ticket unavailable");
  stale(t.version, input.version);
  let values: Partial<typeof s.serviceTickets.$inferInsert> = {
    version: t.version + 1,
    updatedAt: new Date(),
  };
  if (input.action === "ticket.assign") {
    need(a, o, "orders.manage");
    if (t.status === "closed") fail("Reopen the ticket before reassignment");
    await person(tx, o, input.assignedTo, "service.manage");
    values = {
      ...values,
      assignedTo: input.assignedTo,
      priority: input.priority,
      dueAt: new Date(input.dueAt),
    };
  } else {
    if (!can(a, o, "orders.manage")) assigned(a, o, "service.manage", [t.assignedTo]);
    const transitions: Record<string, string[]> = {
      open: ["in_progress"],
      in_progress: ["waiting_customer", "resolved"],
      waiting_customer: ["in_progress", "resolved"],
      resolved: ["closed", "open"],
      closed: ["open"],
    };
    if (!transitions[t.status]?.includes(input.status)) fail("Invalid ticket transition");
    if (["closed", "open"].includes(input.status)) need(a, o, "orders.manage");
    values = {
      ...values,
      status: input.status,
      ...(input.status === "resolved"
        ? { resolution: input.notes, resolvedAt: new Date(), resolvedBy: a.user.id }
        : {}),
      ...(input.status === "closed" ? { closedAt: new Date() } : {}),
      ...(input.status === "open"
        ? { resolution: null, resolvedAt: null, resolvedBy: null, closedAt: null }
        : {}),
    };
  }
  const [next] = await tx
    .update(s.serviceTickets)
    .set(values)
    .where(eq(s.serviceTickets.id, t.id))
    .returning();
  return { before: t, after: next };
}
