import { z } from "zod";
export const loadStatuses = [
  "planned",
  "released",
  "in_production",
  "factory_ready",
  "dispatched",
  "delivered",
  "installation_started",
  "installed",
  "audit_passed",
  "completed",
] as const;
export const labels: Record<string, string> = {
  planned: "Planned",
  released: "Production released",
  in_production: "In production",
  factory_ready: "Factory ready",
  dispatched: "Dispatched",
  delivered: "Delivered",
  installation_started: "Installation started",
  installed: "Installed",
  audit_passed: "Engineer audit passed",
  completed: "Completed",
};
const text = z.string().trim().min(1).max(2000);
export const quantity = z
  .string()
  .regex(/^\d{1,9}(\.\d{1,3})?$/)
  .refine((v) => Number(v) > 0, "Enter a positive quantity");
const amount = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/);
const date = z.iso.datetime({ offset: true });
export const allocationSchema = z
  .object({
    orderId: z.uuid(),
    assignedTo: z.string().min(1).max(200),
    siteReady: z.boolean(),
    notes: text,
    allocations: z
      .array(z.object({ orderItemId: z.uuid(), quantity }))
      .min(1)
      .max(100),
  })
  .superRefine((v, c) => {
    if (new Set(v.allocations.map((a) => a.orderItemId)).size !== v.allocations.length)
      c.addIssue({ code: "custom", message: "Each item may appear only once in a load" });
  });
export const loadActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("allocate"), version: z.int().positive(), plan: allocationSchema }),
  z.object({
    action: z.literal("readiness"),
    version: z.int().positive(),
    siteReady: z.boolean(),
    notes: text,
  }),
  z.object({
    action: z.literal("payment"),
    version: z.int().positive(),
    due: amount,
    verified: amount,
    reference: text,
    terms: text,
    occurredAt: date,
    notes: text,
  }),
  z.object({
    action: z.literal("advance"),
    version: z.int().positive(),
    target: z.enum(loadStatuses),
    occurredAt: date,
    reference: text,
    notes: text,
    estimatedAt: date.optional(),
    glassRequired: z.boolean().optional(),
    glassMeasurementTaken: z.boolean().optional(),
    glassTemplatePrepared: z.boolean().optional(),
    glassTemplateApproved: z.boolean().optional(),
  }),
]);
export const loadFiltersSchema = z.object({
  q: z.string().trim().max(100).default(""),
  organizationId: z.union([z.uuid(), z.literal("")]).default(""),
  orderId: z.union([z.uuid(), z.literal("")]).default(""),
  status: z.union([z.enum(loadStatuses), z.literal("")]).default(""),
  readiness: z.enum(["", "ready", "pending"]).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
