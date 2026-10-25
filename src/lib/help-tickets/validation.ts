import { z } from "zod";
export const statuses = [
  "raised",
  "in_progress",
  "awaiting_confirmation",
  "reopened",
  "closed",
] as const;
export const priorities = ["low", "normal", "high", "urgent"] as const;
export const defaultConcerns = [
  "Quotation",
  "Site Visit",
  "Payment",
  "Production",
  "Delivery",
  "Installation",
  "Service",
  "Other",
] as const;
export const labels: Record<string, string> = {
  raised: "Raised",
  in_progress: "In Progress",
  awaiting_confirmation: "Awaiting Confirmation",
  reopened: "Reopened",
  closed: "Closed",
};
export const sourceSchema = z.object({
  kind: z.enum(["lead", "project", "customer"]),
  id: z.uuid(),
});
export const createSchema = sourceSchema
  .extend({
    requestId: z.uuid(),
    location: z.string().trim().min(1).max(200).optional(),
    concern: z.string().trim().min(1).max(80),
    details: z.string().trim().min(5).max(5000),
    priority: z.enum(priorities),
    assignedTo: z.string().min(1).max(128),
    fileId: z.uuid().optional(),
  })
  .strict();
export const actionSchema = z
  .object({
    version: z.int().positive(),
    action: z.enum(["start", "resolve", "close", "reopen", "reassign"]),
    notes: z.string().trim().min(3).max(5000),
    assignedTo: z.string().max(128).optional(),
    fileId: z.uuid().optional(),
  })
  .strict();
export const filterSchema = z.object({
  q: z.string().trim().max(100).default(""),
  organizationId: z.union([z.uuid(), z.literal("")]).default(""),
  centreId: z.union([z.uuid(), z.literal("")]).default(""),
  resolver: z.string().max(128).default(""),
  status: z.enum(["", ...statuses]).default(""),
  priority: z.enum(["", ...priorities]).default(""),
  tab: z.enum(["all", "raised", "assigned", "confirmation", "reopened", "overdue"]).default("all"),
  from: z.union([z.iso.date(), z.literal("")]).default(""),
  to: z.union([z.iso.date(), z.literal("")]).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
export const policySchema = z
  .object({
    organizationId: z.uuid(),
    code: z
      .string()
      .trim()
      .regex(/^[a-z0-9_-]{1,60}$/),
    name: z.string().trim().min(2).max(80),
    active: z.boolean(),
    attachmentRequired: z.boolean(),
    slaHours: z.int().min(1).max(8760).nullable(),
    version: z.int().nonnegative(),
    notes: z.string().trim().min(3).max(1000),
  })
  .strict();
export const fileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .refine((x) => !/[\x00-\x1f/\\]/.test(x)),
    contentType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
    size: z
      .int()
      .positive()
      .max(10 * 1024 * 1024),
    source: sourceSchema.optional(),
    ticketId: z.uuid().optional(),
  })
  .strict()
  .refine((x) => Boolean(x.source) !== Boolean(x.ticketId), "Choose one upload destination");
export function validFile(bytes: Uint8Array, type: string, size: number) {
  if (bytes.length !== size || size < 1 || size > 10485760) return false;
  const prefix =
    type === "application/pdf"
      ? [37, 80, 68, 70, 45]
      : type === "image/png"
        ? [137, 80, 78, 71, 13, 10, 26, 10]
        : type === "image/jpeg"
          ? [255, 216, 255]
          : [];
  return prefix.length > 0 && prefix.every((b, i) => bytes[i] === b);
}
