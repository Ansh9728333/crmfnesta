import { z } from "zod";
import Decimal from "decimal.js";
import { roles } from "../auth/roles";
import { stageDefinition } from "./definitions";
export const stageNumber = z.coerce.number().int().min(1).max(16);
export const stageActionSchema = z.object({
  action: z.enum(["plan", "save", "start", "submit", "approve", "reject"]),
  version: z.number().int().positive(),
  assignedTo: z.string().min(1).max(100).optional(),
  plannedAt: z.iso.datetime({ offset: true }).optional(),
  notes: z.string().trim().max(4000).default(""),
  data: z.record(z.string(), z.unknown()).default({}),
  reason: z.string().trim().max(2000).default(""),
});
export const policySchema = z.object({
  organizationId: z.uuid(),
  number: stageNumber,
  version: z.number().int().min(0),
  ownerRole: z.enum(roles),
  approverRole: z.enum(roles),
  requiredFields: z.array(z.string().min(1).max(80)).max(30),
  applyToPending: z.boolean().default(false),
});
export const orderFiltersSchema = z.object({
  q: z.string().trim().max(200).default(""),
  organizationId: z.union([z.uuid(), z.literal("")]).default(""),
  status: z
    .enum(["", "active", "completed", "overdue", "unassigned", "awaiting_approval", "mine"])
    .default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
const amount = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/);
const measurement = z.object({
  label: z.string().trim().min(1).max(120),
  value: z
    .string()
    .regex(/^\d{1,9}(\.\d{1,3})?$/)
    .refine((v) => new Decimal(v).gt(0)),
  unit: z.enum(["mm", "cm", "m", "ft", "in", "sq ft", "sq m", "count"]),
});
export function parseStageData(number: number, raw: Record<string, unknown>) {
  const def = stageDefinition(number),
    known = new Set(def.fields.map((f) => f.key));
  if (Object.keys(raw).some((k) => !known.has(k))) throw new Error("Unrecognized stage field");
  const result: Record<string, unknown> = {};
  for (const field of def.fields) {
    const value = raw[field.key];
    if (value === undefined || value === null || value === "") continue;
    let schema: z.ZodType;
    switch (field.type) {
      case "boolean":
        schema = z.boolean();
        break;
      case "amount":
        schema = amount;
        break;
      case "integer":
        schema = z.coerce.number().int().min(1).max(100);
        break;
      case "datetime":
        schema = z.iso.datetime({ offset: true });
        break;
      case "url":
        schema = z
          .url()
          .max(2000)
          .refine((v) => {
            const url = new URL(v);
            return url.protocol === "https:" && !url.username && !url.password;
          });
        break;
      case "measurements":
        schema = z.array(measurement).min(1).max(100);
        break;
      case "select":
        schema = z.enum(field.options as [string, ...string[]]);
        break;
      default:
        schema = z
          .string()
          .trim()
          .min(1)
          .max(field.type === "textarea" ? 4000 : 200);
    }
    result[field.key] = schema.parse(value);
  }
  if (
    number === 13 &&
    ((result.glassTemplatePrepared === true && result.glassMeasurementTaken !== true) ||
      (result.glassTemplateApproved === true && result.glassTemplatePrepared !== true))
  )
    throw new Error("Glass checks must follow measurement, preparation and approval order");
  return result;
}
export function validateMandatory(
  number: number,
  data: Record<string, unknown>,
  notes: string,
  required: string[],
  files: number,
  isGlass: boolean,
) {
  const def = stageDefinition(number),
    all = new Set([...def.requiredFields, ...required]);
  for (const key of all) {
    if (
      number === 16 &&
      ["testimonial", "reviewUrl"].includes(key) &&
      data.reviewOutcome !== "received"
    )
      continue;
    const field = def.fields.find((f) => f.key === key);
    if (field?.glassOnly && !isGlass) continue;
    if (key === "attachments") {
      if (!files) throw new Error("Upload required stage attachments before submitting");
      continue;
    }
    if (key === "notes") {
      if (notes.trim().length < 3) throw new Error("Stage notes are required");
      continue;
    }
    const value = data[key];
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && !value.length)
    )
      throw new Error(`${field?.label ?? key} is required`);
  }
  for (const key of [
    "siteReady",
    "factoryReady",
    "allLoadsInstalled",
    "auditPassed",
    "handoverAccepted",
  ]) {
    if (def.fields.some((f) => f.key === key) && data[key] !== true)
      throw new Error("Required completion checks have not passed");
  }
  for (const field of def.fields.filter((f) => f.type === "datetime" && !(number === 3))) {
    if (data[field.key] && new Date(String(data[field.key])).getTime() > Date.now())
      throw new Error("Actual completion/evidence dates cannot be in the future");
  }
  if (number === 1) {
    const url = new URL(String(data.groupLink));
    if (url.hostname !== "chat.whatsapp.com" || url.pathname.length < 2)
      throw new Error("Enter a WhatsApp group invitation link");
  }
}
