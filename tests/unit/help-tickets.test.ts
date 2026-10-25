import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  createSchema,
  actionSchema,
  fileSchema,
  validFile,
  policySchema,
} from "../../src/lib/help-tickets/validation";
describe("help ticket input and evidence", () => {
  it("takes identity only from the session, requires details and a resolver", () => {
    const input = {
      kind: "lead",
      id: randomUUID(),
      requestId: randomUUID(),
      concern: "service",
      details: "Window lock concern",
      priority: "high",
      assignedTo: "engineer",
    };
    expect(createSchema.safeParse(input).success).toBe(true);
    expect(createSchema.safeParse({ ...input, createdBy: "impersonation" }).success).toBe(false);
    expect(createSchema.safeParse({ ...input, details: " " }).success).toBe(false);
    expect(createSchema.safeParse({ ...input, assignedTo: "" }).success).toBe(false);
  });
  it("requires reasons, versions and bounded uploads", () => {
    expect(actionSchema.safeParse({ action: "reopen", version: 1, notes: "" }).success).toBe(false);
    expect(
      fileSchema.safeParse({
        name: "a.pdf",
        contentType: "application/pdf",
        size: 10485761,
        source: { kind: "lead", id: randomUUID() },
      }).success,
    ).toBe(false);
    expect(
      fileSchema.safeParse({
        name: "../a.pdf",
        contentType: "application/pdf",
        size: 30,
        source: { kind: "lead", id: randomUUID() },
      }).success,
    ).toBe(false);
  });
  it("checks file bytes rather than the claimed MIME alone", () => {
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(validFile(png, "image/png", 8)).toBe(true);
    expect(validFile(png, "application/pdf", 8)).toBe(false);
    expect(validFile(png, "image/png", 10)).toBe(false);
    expect(validFile(new Uint8Array([60, 115, 118, 103]), "image/svg+xml", 4)).toBe(false);
  });
  it("validates administrator SLA and reason", () => {
    const p = {
      organizationId: randomUUID(),
      code: "service",
      name: "Service",
      active: true,
      attachmentRequired: true,
      slaHours: 24,
      version: 1,
      notes: "New SLA",
    };
    expect(policySchema.safeParse(p).success).toBe(true);
    expect(policySchema.safeParse({ ...p, slaHours: 0 }).success).toBe(false);
  });
});
