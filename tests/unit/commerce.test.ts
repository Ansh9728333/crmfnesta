import { describe, it, expect } from "vitest";
import { commerceActionSchema, assertUnique } from "../../src/lib/commerce/validation";
const id = "550e8400-e29b-41d4-a716-446655440000",
  date = "2020-01-01T10:00:00+05:30";
describe("financial and delivery input boundaries", () => {
  it("requires positive exact two-place money for installments", () => {
    for (const amount of ["-1", "0", "1e2", "0.001"])
      expect(
        commerceActionSchema.safeParse({
          action: "payment.record",
          amount,
          mode: "upi",
          reference: "bank reference",
          receivedAt: date,
          notes: "Receipt",
        }).success,
      ).toBe(false);
    expect(
      commerceActionSchema.safeParse({
        action: "payment.record",
        amount: "0.10",
        mode: "upi",
        reference: "bank reference",
        receivedAt: date,
        notes: "Receipt",
      }).success,
    ).toBe(true);
  });
  it("allows documented zero-due credit milestones", () => {
    expect(
      commerceActionSchema.safeParse({
        action: "milestone.save",
        version: 0,
        loadId: id,
        name: "Approved credit",
        amount: "0.00",
        beforeDispatch: true,
        contractReference: "Signed credit terms",
        notes: "Admin confirms credit",
      }).success,
    ).toBe(true);
  });
  it("treats damaged quantities as part of actual material received", () => {
    const input = {
      action: "delivery.create",
      dispatchId: id,
      deliveredAt: date,
      receivedBy: "Site representative",
      remarks: "Partial delivery",
      items: [{ dispatchItemId: id, received: "8", damaged: "2", missing: "2" }],
    };
    expect(commerceActionSchema.safeParse(input).success).toBe(true);
    expect(
      commerceActionSchema.safeParse({ ...input, items: [{ ...input.items[0], damaged: "9" }] })
        .success,
    ).toBe(false);
  });
  it("rejects repeated item identities and empty delivery observations", () => {
    expect(() => assertUnique([id, id])).toThrow();
    expect(
      commerceActionSchema.safeParse({
        action: "delivery.create",
        dispatchId: id,
        deliveredAt: date,
        receivedBy: "Site",
        remarks: "No quantities",
        items: [{ dispatchItemId: id, received: "0", damaged: "0", missing: "0" }],
      }).success,
    ).toBe(false);
  });
});
