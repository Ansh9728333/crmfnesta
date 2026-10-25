import { z } from "zod";
import Decimal from "decimal.js";
export const auditChecks = [
  "measurements",
  "fixings",
  "alignment",
  "operation",
  "finish",
  "safety",
  "cleanliness",
] as const;
export const handoverDocumentKinds = [
  "handover_certificate",
  "installation_report",
  "warranty_document",
] as const;
export const aftercareFileKinds = [
  "installation_photo",
  "glass_template",
  "audit_photo",
  ...handoverDocumentKinds,
  "ticket_photo",
] as const;
const text = z.string().trim().min(1).max(3000),
  id = z.uuid(),
  employee = z.string().min(1).max(200),
  version = z.int().positive(),
  date = z.iso.datetime({ offset: true });
const quantity = z
  .string()
  .regex(/^\d{1,9}(\.\d{1,3})?$/)
  .refine((v) => new Decimal(v).gt(0));
export const aftercareActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("installation.plan"),
    loadId: id,
    version: z.int().nonnegative(),
    assignedTo: employee,
    teamName: text,
    teamMembers: z.array(employee).min(1).max(30),
    plannedAt: date,
    remarks: text,
  }),
  z.object({
    action: z.literal("installation.start"),
    id,
    version,
    occurredAt: date,
    glassRequired: z.boolean().optional(),
    notes: text,
  }),
  z.object({
    action: z.literal("installation.progress"),
    id,
    version,
    loadItemId: id,
    quantity,
    occurredAt: date,
    requestId: id,
    notes: text,
  }),
  z.object({
    action: z.literal("installation.complete"),
    id,
    version,
    occurredAt: date,
    notes: text,
  }),
  z.object({
    action: z.literal("glass.measure"),
    installationId: id,
    version,
    responsibleId: employee,
    occurredAt: date,
    dimensions: z
      .array(
        z.object({ label: text, value: quantity, unit: z.enum(["mm", "cm", "m", "ft", "in"]) }),
      )
      .min(1)
      .max(50),
    notes: text,
  }),
  z.object({
    action: z.literal("glass.prepare"),
    installationId: id,
    version,
    templateFileId: id,
    occurredAt: date,
    notes: text,
  }),
  z.object({
    action: z.literal("glass.approve"),
    installationId: id,
    version,
    occurredAt: date,
    notes: text,
  }),
  z.object({
    action: z.literal("audit.plan"),
    installationId: id,
    version: z.int().nonnegative(),
    engineerId: employee,
    plannedAt: date,
    notes: text,
  }),
  z.object({
    action: z.literal("audit.inspect"),
    id,
    version,
    inspectionAt: date,
    checklist: z
      .array(
        z.object({
          key: z.enum(auditChecks),
          result: z.enum(["pass", "fail", "not_applicable"]),
          notes: z.string().trim().max(2000),
        }),
      )
      .length(auditChecks.length)
      .refine((v) => new Set(v.map((c) => c.key)).size === auditChecks.length),
    notes: text,
  }),
  z.object({
    action: z.enum(["audit.submit", "audit.approve", "audit.changes"]),
    id,
    version,
    notes: text,
  }),
  z.object({
    action: z.literal("punch.create"),
    auditId: id,
    description: text,
    assignedTo: employee,
    dueAt: date,
    notes: text,
  }),
  z.object({ action: z.literal("punch.resolve"), id, version, occurredAt: date, notes: text }),
  z.object({
    action: z.literal("load.complete"),
    loadId: id,
    version,
    occurredAt: date,
    notes: text,
  }),
  z.object({ action: z.literal("handover.prepare"), notes: text }),
  z.object({
    action: z.literal("handover.confirm"),
    id,
    version,
    occurredAt: date,
    customerAccepted: z.literal(true),
    customerRepresentative: text,
    acceptanceReference: text,
    notes: text,
  }),
  z.object({
    action: z.literal("feedback.save"),
    version: z.int().nonnegative(),
    googleRequestedAt: date.optional(),
    testimonialRequestedAt: date.optional(),
    status: z.enum(["pending", "requested", "received", "declined", "no_response"]),
    receivedAt: date.optional(),
    comments: text,
    testimonial: z.string().trim().max(6000).optional(),
    reviewUrl: z.union([z.url().startsWith("https://"), z.literal("")]).optional(),
    rating: z.int().min(1).max(5).optional(),
    publicationConsent: z.boolean(),
  }),
  z.object({
    action: z.literal("ticket.create"),
    title: text,
    description: text,
    kind: z.enum(["service", "complaint"]),
    assignedTo: employee,
    priority: z.enum(["low", "normal", "high", "urgent"]),
    dueAt: date,
    notes: text,
  }),
  z.object({
    action: z.literal("ticket.assign"),
    id,
    version,
    assignedTo: employee,
    priority: z.enum(["low", "normal", "high", "urgent"]),
    dueAt: date,
    notes: text,
  }),
  z.object({
    action: z.literal("ticket.status"),
    id,
    version,
    status: z.enum(["open", "in_progress", "waiting_customer", "resolved", "closed"]),
    notes: text,
  }),
]);
export const aftercareFilters = z.object({
  q: z.string().trim().max(100).default(""),
  organizationId: z.union([id, z.literal("")]).default(""),
  status: z
    .enum([
      "",
      "planned",
      "in_progress",
      "completed",
      "open",
      "waiting_customer",
      "resolved",
      "closed",
    ])
    .default(""),
  priority: z.enum(["", "low", "normal", "high", "urgent"]).default(""),
  overdue: z.enum(["", "yes"]).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
