import { describe, expect, it } from "vitest";
import { leadFormSchema, leadFiltersSchema, mobileSchema } from "../../src/lib/leads/validation";
describe("Indian mobile normalization", () => {
  it("normalizes supported domestic and +91 representations", () => {
    for (const value of ["9876543210", "+91 98765 43210", "91-9876543210", "09876543210"])
      expect(mobileSchema.parse(value)).toBe("+919876543210");
  });
  it("rejects landlines, wrong country codes, letters and bad lengths", () => {
    for (const value of [
      "1234567890",
      "+1 9876543210",
      "987654321",
      "98765432100",
      "98765abc10",
      "+44 9876543210",
      "++91 9876543210",
      "+9876543210",
      "98765+43210",
    ])
      expect(mobileSchema.safeParse(value).success).toBe(false);
  });
});
describe("pre-sales input boundaries", () => {
  const sample = {
    organizationId: "11111111-1111-4111-8111-111111111111",
    centreId: "22222222-2222-4222-8222-222222222222",
    assignedTo: "employee",
    clientName: "Test Customer",
    mobile: "9876543210",
    projectName: "Test project",
    siteAddress: "Test site address",
  };
  it("allows initial leads without a finalised value", () => {
    expect(leadFormSchema.parse(sample).finalisedValue).toBe("");
  });
  it("requires a Lost reason and a valid final-stage outcome", () => {
    expect(leadFormSchema.safeParse({ ...sample, stage: 7, outcome: "lost" }).success).toBe(false);
    expect(
      leadFormSchema.safeParse({
        ...sample,
        stage: 7,
        outcome: "lost",
        lossReason: "Customer postponed",
      }).success,
    ).toBe(true);
    expect(leadFormSchema.safeParse({ ...sample, stage: 7 }).success).toBe(false);
  });
  it("validates exact decimal precision, FY and follow-up action", () => {
    for (const extra of [
      { expectedValue: "-1" },
      { expectedValue: "1.001" },
      { orderQty: "1.0001" },
      { financialYear: "2026-28" },
      { nextFollowUp: "2026-11-01T09:00:00+05:30" },
    ])
      expect(leadFormSchema.safeParse({ ...sample, ...extra }).success).toBe(false);
    expect(
      leadFormSchema.safeParse({
        ...sample,
        expectedValue: "500000.25",
        financialYear: "2026-27",
        discountOffered: "5%",
      }).success,
    ).toBe(true);
  });
  it("bounds pagination and filter inputs", () => {
    expect(leadFiltersSchema.safeParse({ pageSize: 1000 }).success).toBe(false);
    expect(leadFiltersSchema.safeParse({ page: 0 }).success).toBe(false);
    expect(leadFiltersSchema.safeParse({ q: "a".repeat(101) }).success).toBe(false);
  });
});
