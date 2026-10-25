import { describe, it, expect } from "vitest";
import { allocationSchema, loadActionSchema } from "../../src/lib/production/validation";
const id = "550e8400-e29b-41d4-a716-446655440000";
const plan = {
  orderId: id,
  assignedTo: "employee",
  siteReady: false,
  notes: "Pending site",
  allocations: [{ orderItemId: id, quantity: "30" }],
};
describe("production load input contracts", () => {
  it("accepts positive fractional quantities and pending readiness", () => {
    expect(
      allocationSchema.parse({ ...plan, allocations: [{ orderItemId: id, quantity: "0.001" }] })
        .siteReady,
    ).toBe(false);
  });
  it("rejects repeated item rows in one load", () => {
    expect(
      allocationSchema.safeParse({
        ...plan,
        allocations: [...plan.allocations, ...plan.allocations],
      }).success,
    ).toBe(false);
  });
  it("rejects zero, negative, exponent and excess precision quantities", () => {
    for (const quantity of ["0", "-1", "1e3", "1.0001"])
      expect(
        allocationSchema.safeParse({ ...plan, allocations: [{ orderItemId: id, quantity }] })
          .success,
      ).toBe(false);
  });
  it("requires evidence for transitions and Accounts verification", () => {
    expect(
      loadActionSchema.safeParse({ action: "advance", version: 1, target: "completed" }).success,
    ).toBe(false);
    expect(
      loadActionSchema.safeParse({ action: "payment", version: 1, due: "40", verified: "40" })
        .success,
    ).toBe(false);
  });
});
