import { z } from "zod";
export const reports = {
  sales: "Company-wise Sales Report",
  employees: "Employee Performance Report",
  conversion: "Pre-Sales Conversion Report",
  quotations: "Quotation Revision Report",
  production: "Production Load Report",
  payments: "Payment Collection Report",
  dispatch: "Dispatch Delay Report",
  installation: "Installation Progress Report",
  audits: "Engineer Audit Report",
  handover: "Site Handover Report",
} as const;
export type Report = keyof typeof reports;
const optionalDate = z.union([z.iso.date(), z.literal("")]).default("");
export const filterSchema = z
  .object({
    organizationId: z.union([z.uuid(), z.literal("")]).default(""),
    financialYear: z
      .string()
      .regex(/^(\d{4}-\d{2})?$/)
      .refine((v) => !v || String(Number(v.slice(0, 4)) + 1).slice(-2) === v.slice(-2))
      .default(""),
    from: optionalDate,
    to: optionalDate,
    territory: z.string().trim().max(100).default(""),
    executiveId: z.string().max(200).default(""),
    status: z
      .enum([
        "",
        "active",
        "won",
        "lost",
        "completed",
        "planned",
        "released",
        "in_production",
        "factory_ready",
        "dispatched",
        "delivered",
        "installation_started",
        "installed",
        "audit_passed",
        "pending",
        "verified",
        "rejected",
        "draft",
        "approved",
        "partially_delivered",
        "cancelled",
        "in_progress",
        "submitted",
        "changes_required",
        "confirmed",
      ])
      .default(""),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, "Start date must not follow end date");
export type Filters = z.infer<typeof filterSchema>;
export const catalogKinds = [
  "company_profile",
  "territory",
  "product_category",
  "payment_template",
  "document_requirement",
  "sla",
] as const;
const description = z.string().trim().max(2000).default("");
export const catalogConfig = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("company_profile"),
    config: z.object({
      legalName: z.string().trim().min(1).max(200),
      address: description,
      email: z.union([z.email(), z.literal("")]),
      phone: z.string().trim().max(25),
      gstin: z.string().trim().max(15),
    }),
  }),
  z.object({ kind: z.literal("territory"), config: z.object({ description }) }),
  z.object({
    kind: z.literal("product_category"),
    config: z.object({ description, unit: z.string().trim().min(1).max(30) }),
  }),
  z.object({
    kind: z.literal("payment_template"),
    config: z.object({
      percentage: z.string().regex(/^(100(\.0{1,2})?|\d{1,2}(\.\d{1,2})?)$/),
      beforeDispatch: z.boolean(),
      offsetDays: z.int().min(0).max(365),
      description,
    }),
  }),
  z.object({
    kind: z.literal("document_requirement"),
    config: z.object({ stageNumber: z.int().min(1).max(16), description }),
  }),
  z.object({
    kind: z.literal("sla"),
    config: z.object({
      target: z.enum(["follow_up", "production", "payment", "dispatch", "installation", "audit"]),
      graceHours: z.int().min(0).max(720),
      description,
    }),
  }),
]);
export const catalogSchema = z.object({
  id: z.uuid().optional(),
  organizationId: z.uuid(),
  code: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9_-]{0,59}$/),
  name: z.string().trim().min(2).max(100),
  active: z.boolean(),
  version: z.int().nonnegative(),
  notes: z.string().trim().min(3).max(2000),
});
export const notificationKinds = [
  "follow_up",
  "production",
  "payment",
  "installation",
  "audit",
] as const;
export const notificationAction = z.object({
  kind: z.enum(notificationKinds),
  entityId: z.uuid(),
  dueAt: z.iso.datetime({ offset: true }),
  state: z.enum(["read", "dismissed"]),
});
export const dateBound = (value: string, end = false) =>
  new Date(new Date(`${value}T00:00:00+05:30`).getTime() + (end ? 86400000 : 0));
