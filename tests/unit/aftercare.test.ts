import { describe, it, expect } from "vitest";
import { aftercareActionSchema, auditChecks } from "../../src/lib/aftercare/validation";
const id = "550e8400-e29b-41d4-a716-446655440000",
  date = "2020-01-01T10:00:00+05:30";
describe("installation and aftercare validation", () => {
  it("accepts exact fractional installed quantities and rejects zero, negative and exponent input", () => {
    for (const quantity of ["0", "-1", "1e3", "0.0001"]) {
      expect(
        aftercareActionSchema.safeParse({
          action: "installation.progress",
          id,
          version: 1,
          loadItemId: id,
          quantity,
          occurredAt: date,
          requestId: id,
          notes: "Installed",
        }).success,
      ).toBe(false);
    }
    expect(
      aftercareActionSchema.safeParse({
        action: "installation.progress",
        id,
        version: 1,
        loadItemId: id,
        quantity: "0.125",
        occurredAt: date,
        requestId: id,
        notes: "Installed",
      }).success,
    ).toBe(true);
  });
  it("requires every distinct canonical audit check", () => {
    const base = {
      action: "audit.inspect",
      id,
      version: 1,
      inspectionAt: date,
      notes: "Inspection",
      checklist: auditChecks.map((key) => ({ key, result: "pass", notes: "Checked" })),
    };
    expect(aftercareActionSchema.safeParse(base).success).toBe(true);
    expect(
      aftercareActionSchema.safeParse({
        ...base,
        checklist: base.checklist.map(() => base.checklist[0]),
      }).success,
    ).toBe(false);
  });
  it("requires explicit customer acceptance and signed reference", () => {
    const base = {
      action: "handover.confirm",
      id,
      version: 1,
      occurredAt: date,
      customerAccepted: true,
      customerRepresentative: "Customer",
      acceptanceReference: "Signed acceptance",
      notes: "Handover",
    };
    expect(aftercareActionSchema.safeParse(base).success).toBe(true);
    expect(aftercareActionSchema.safeParse({ ...base, customerAccepted: false }).success).toBe(
      false,
    );
    expect(aftercareActionSchema.safeParse({ ...base, acceptanceReference: "" }).success).toBe(
      false,
    );
  });
  it("allows declined reviews without rating, testimonial or URL and permits negative feedback", () => {
    const base = {
      action: "feedback.save",
      version: 0,
      status: "declined",
      googleRequestedAt: date,
      comments: "Customer declined",
      publicationConsent: false,
    };
    expect(aftercareActionSchema.safeParse(base).success).toBe(true);
    expect(
      aftercareActionSchema.safeParse({ ...base, status: "received", rating: 1, receivedAt: date })
        .success,
    ).toBe(true);
    expect(aftercareActionSchema.safeParse({ ...base, rating: 6 }).success).toBe(false);
  });
  it("requires resolution notes and an assigned engineer with a due date for service", () => {
    expect(
      aftercareActionSchema.safeParse({
        action: "ticket.status",
        id,
        version: 1,
        status: "resolved",
        notes: "",
      }).success,
    ).toBe(false);
    expect(
      aftercareActionSchema.safeParse({
        action: "ticket.create",
        title: "Repair",
        description: "Issue",
        kind: "complaint",
        priority: "urgent",
        assignedTo: "employee",
        notes: "Recorded",
      }).success,
    ).toBe(false);
  });
});
