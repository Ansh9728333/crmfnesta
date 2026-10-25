import { z } from "zod";
import Decimal from "decimal.js";
export const text = z.string().trim().min(1).max(2000);
export const money = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/);
export const positiveMoney = money.refine((v) => new Decimal(v).gt(0));
export const quantity = z.string().regex(/^\d{1,9}(\.\d{1,3})?$/);
const positiveQuantity = quantity.refine((v) => new Decimal(v).gt(0));
const date = z.iso.datetime({ offset: true });
const id = z.uuid(),
  version = z.int().positive();
const rows = <T extends z.ZodType>(schema: T) => z.array(schema).min(1).max(100);
export const commerceActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("payment.record"),
    amount: positiveMoney,
    mode: z.enum(["bank_transfer", "upi", "card", "cheque", "cash", "other"]),
    reference: text,
    receivedAt: date,
    notes: text,
  }),
  z.object({ action: z.enum(["payment.verify", "payment.reject"]), id, version, notes: text }),
  z.object({
    action: z.literal("milestone.save"),
    id: id.optional(),
    version: z.int().nonnegative(),
    loadId: id,
    name: text,
    amount: money,
    dueAt: date.optional(),
    beforeDispatch: z.boolean(),
    contractReference: text,
    notes: text,
  }),
  z.object({
    action: z.literal("payment.allocate"),
    paymentId: id,
    milestoneId: id,
    amount: positiveMoney,
    notes: text,
  }),
  z.object({
    action: z.literal("dispatch.create"),
    loadId: id,
    reference: text,
    transporter: text,
    vehicleNumber: text,
    expectedAt: date,
    notes: text,
    items: rows(z.object({ loadItemId: id, quantity: positiveQuantity })),
  }),
  z.object({ action: z.enum(["dispatch.approve", "dispatch.cancel"]), id, version, notes: text }),
  z.object({ action: z.literal("dispatch.ship"), id, version, dispatchedAt: date, notes: text }),
  z.object({
    action: z.literal("delivery.create"),
    dispatchId: id,
    deliveredAt: date,
    receivedBy: text,
    remarks: text,
    items: rows(
      z.object({ dispatchItemId: id, received: quantity, damaged: quantity, missing: quantity }),
    ).superRefine((items, c) => {
      for (const i of items)
        if (new Decimal(i.damaged).gt(i.received) || new Decimal(i.received).plus(i.missing).lte(0))
          c.addIssue({ code: "custom", message: "Check received, damaged and missing quantities" });
    }),
  }),
  z.object({ action: z.enum(["delivery.confirm", "delivery.cancel"]), id, version, notes: text }),
]);
export const commerceFilters = z.object({
  q: z.string().trim().max(100).default(""),
  organizationId: z.union([id, z.literal("")]).default(""),
  status: z.enum(["", "pending", "outstanding", "partial", "delivered"]).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
export function assertUnique(ids: string[]) {
  z.array(z.string())
    .refine((v) => new Set(v).size === v.length, "An item may appear only once")
    .parse(ids);
}
