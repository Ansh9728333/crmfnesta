import { z } from "zod";
const text = (max = 4000) => z.string().trim().max(max).default("");
export const amount = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, "Use an INR amount with at most two decimal places");
export const quantity = z
  .string()
  .regex(/^\d{1,9}(\.\d{1,3})?$/)
  .refine((v) => Number(v) > 0, "Quantity must be positive");
export const appointmentSchema = z
  .object({
    id: z.uuid().optional(),
    version: z.number().int().positive().optional(),
    assignedTo: z.string().min(1).max(100),
    scheduledAt: z.iso.datetime({ offset: true }),
    status: z.enum(["scheduled", "confirmed", "completed", "cancelled", "no-show"]),
    observations: text(),
    measurements: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(120),
          value: quantity,
          unit: z.enum(["mm", "cm", "m", "ft", "in", "sq ft", "sq m", "count"]),
        }),
      )
      .max(100)
      .default([]),
    nextFollowUp: z.union([z.iso.datetime({ offset: true }), z.literal("")]).default(""),
    nextAction: text(500),
  })
  .superRefine((v, ctx) => {
    if (v.id && !v.version)
      ctx.addIssue({ code: "custom", path: ["version"], message: "Appointment version required" });
    if (v.status === "completed" && !v.observations)
      ctx.addIssue({
        code: "custom",
        path: ["observations"],
        message: "Record site observations before completing a visit",
      });
    if (v.nextFollowUp && !v.nextAction)
      ctx.addIssue({ code: "custom", path: ["nextAction"], message: "Follow-up action required" });
  });
export const quotationSchema = z
  .object({
    expectedRevision: z.number().int().min(0),
    revisionReason: text(1000),
    customerNotes: text(),
    items: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(150),
          description: text(1000),
          productCompanyId: z.uuid(),
          quantity,
          unitPrice: amount,
          discount: amount.default("0"),
        }),
      )
      .min(1)
      .max(50),
  })
  .superRefine((v, ctx) => {
    if (v.expectedRevision > 0 && v.revisionReason.length < 3)
      ctx.addIssue({
        code: "custom",
        path: ["revisionReason"],
        message: "A revision reason is required",
      });
  });
export const decisionSchema = z.object({
  quotationId: z.uuid(),
  decision: z.enum(["approved", "accepted", "rejected"]),
  evidence: z.string().trim().min(3).max(2000),
});
export const engagementSchema = z
  .object({
    kind: z.enum(["showroom", "negotiation"]),
    occurredAt: z.iso.datetime({ offset: true }),
    outcome: z.string().trim().min(2).max(200),
    notRequired: z.boolean().default(false),
    reason: text(1000),
    notes: text(),
    offeredValue: z.union([amount, z.literal("")]).default(""),
  })
  .superRefine((v, ctx) => {
    if (v.notRequired && (v.kind !== "showroom" || v.reason.length < 3))
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Not Required applies to showroom visits and requires a reason",
      });
    if (v.kind === "negotiation" && !v.notes)
      ctx.addIssue({ code: "custom", path: ["notes"], message: "Record negotiation details" });
  });
export const conversionSchema = z.object({
  version: z.number().int().positive(),
  organizationId: z.uuid(),
  quotationId: z.uuid(),
  finalValue: amount,
  quantitiesConfirmed: z.literal(true),
});
