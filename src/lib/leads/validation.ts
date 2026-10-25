import { z } from "zod";

export const mobileSchema = z
  .string()
  .trim()
  .max(25)
  .transform((value) => {
    if (!/^\+?[\d\s().-]+$/.test(value)) return "";
    let digits = value.replace(/\D/g, "");
    if (value.startsWith("+") && !(digits.length === 12 && digits.startsWith("91"))) return "";
    if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
    if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : "";
  })
  .refine(Boolean, "Enter a valid Indian mobile number (10 digits starting with 6–9)");
const optionalText = (max = 200) => z.string().trim().max(max).default("");
const decimal = (whole: number, scale: number) =>
  z
    .string()
    .trim()
    .max(20)
    .refine(
      (value) => value === "" || new RegExp(`^\\d{1,${whole}}(?:\\.\\d{1,${scale}})?$`).test(value),
      "Enter a non-negative decimal with the allowed precision",
    )
    .default("");
const optionalId = z.union([z.uuid(), z.literal("")]).default("");
export const leadFormSchema = z
  .object({
    organizationId: z.uuid(),
    centreId: z.uuid(),
    assignedTo: z.string().min(1).max(100),
    clientName: z.string().trim().min(2).max(120),
    mobile: mobileSchema,
    customerId: optionalId,
    projectId: optionalId,
    projectName: optionalText(150),
    bookingMonth: z.union([z.coerce.number().int().min(1).max(12), z.literal("")]).optional(),
    financialYear: optionalText(7).refine(
      (value) =>
        !value ||
        (/^20\d{2}-\d{2}$/.test(value) &&
          Number(value.slice(5)) === (Number(value.slice(0, 4)) + 1) % 100),
      "Use a financial year such as 2026-27",
    ),
    brand: optionalText(),
    cseId: z.string().max(100).default(""),
    siteAddress: z.string().trim().min(5).max(1000),
    territory: optionalText(),
    soe: optionalText(),
    customerType: optionalText(),
    buildingType: optionalText(),
    orderType: optionalText(),
    finalisedValue: decimal(12, 2),
    orderQty: decimal(9, 3),
    pleatedMeshQty: decimal(9, 3),
    material: z.enum(["", "uPVC", "Aluminium"]).default(""),
    discountOffered: optionalText(),
    source: optionalText(),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    expectedValue: decimal(12, 2),
    nextFollowUp: z.union([z.iso.datetime({ offset: true }), z.literal("")]).default(""),
    nextAction: optionalText(500),
    remarks: optionalText(4000),
    stage: z.coerce.number().int().min(1).max(7).default(1),
    outcome: z.enum(["open", "won", "lost"]).default("open"),
    lossReason: optionalText(1000),
    duplicateAcknowledged: z.boolean().default(false),
    duplicateReason: optionalText(500),
  })
  .superRefine((value, ctx) => {
    if (!value.projectId && value.projectName.length < 2)
      ctx.addIssue({
        code: "custom",
        path: ["projectName"],
        message: "Enter a project name or select an existing project",
      });
    if (value.projectId && !value.customerId)
      ctx.addIssue({
        code: "custom",
        path: ["customerId"],
        message: "Select the project's customer",
      });
    if ((value.stage === 7) !== (value.outcome !== "open"))
      ctx.addIssue({
        code: "custom",
        path: ["outcome"],
        message: "Choose Won or Lost for the final stage",
      });
    if (value.outcome === "lost" && value.lossReason.length < 3)
      ctx.addIssue({ code: "custom", path: ["lossReason"], message: "A Lost reason is required" });
    if (value.outcome === "won" && (!value.finalisedValue || Number(value.finalisedValue) <= 0))
      ctx.addIssue({
        code: "custom",
        path: ["finalisedValue"],
        message: "Enter the finalised order value before marking Won",
      });
    if (value.nextFollowUp && !value.nextAction)
      ctx.addIssue({
        code: "custom",
        path: ["nextAction"],
        message: "Describe the follow-up action",
      });
    if (value.duplicateAcknowledged && value.duplicateReason.length < 3)
      ctx.addIssue({
        code: "custom",
        path: ["duplicateReason"],
        message: "Explain why a separate lead is needed",
      });
  });
export const updateLeadSchema = z.object({
  data: leadFormSchema,
  version: z.number().int().positive(),
});
export const followUpSchema = z.object({
  version: z.number().int().positive(),
  dueAt: z.iso.datetime({ offset: true }),
  action: z.string().trim().min(2).max(500),
});
export const activitySchema = z.object({
  version: z.number().int().positive(),
  notes: z.string().trim().min(2).max(4000),
});
export const leadFiltersSchema = z.object({
  customerId: optionalId,
  projectId: optionalId,
  q: z.string().trim().max(100).default(""),
  organizationId: optionalId,
  centreId: optionalId,
  assignedTo: z.string().max(100).default(""),
  stage: z.union([z.coerce.number().int().min(1).max(7), z.literal("")]).optional(),
  outcome: z.enum(["", "open", "won", "lost"]).default(""),
  priority: z.enum(["", "low", "normal", "high", "urgent"]).default(""),
  source: optionalText(),
  territory: optionalText(),
  financialYear: optionalText(7),
  bookingMonth: z.union([z.coerce.number().int().min(1).max(12), z.literal("")]).optional(),
  followUp: z.enum(["", "overdue", "today", "upcoming", "none"]).default(""),
  archived: z.enum(["", "yes"]).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(20),
});
export type LeadInput = z.infer<typeof leadFormSchema>;
export type LeadFilters = z.infer<typeof leadFiltersSchema>;
export const customerSchema = z.object({
  organizationId: z.uuid(),
  centreId: z.uuid(),
  assignedTo: z.string().min(1).max(100),
  name: z.string().trim().min(2).max(120),
  mobile: mobileSchema,
  email: z.union([z.email(), z.literal("")]).default(""),
});
export const projectSchema = z.object({
  organizationId: z.uuid(),
  customerId: z.uuid(),
  centreId: z.uuid(),
  assignedTo: z.string().min(1).max(100),
  name: z.string().trim().min(2).max(150),
  siteAddress: z.string().trim().min(5).max(1000),
});
