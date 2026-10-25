import { describe, it, expect } from "vitest";
import { priceQuotation } from "../../src/lib/presales/pricing";
import { quotationSchema, engagementSchema } from "../../src/lib/presales/validation";
const item = {
  name: "Window",
  productCompanyId: "00000000-0000-4000-8000-000000000001",
  description: "",
  quantity: "3",
  unitPrice: "0.10",
  discount: "0",
};
describe("quotation pricing and workflow validation", () => {
  it("uses exact decimal arithmetic and explicit INR discounts", () => {
    const priced = priceQuotation(quotationSchema.parse({ expectedRevision: 0, items: [item] }));
    expect(priced.amount).toBe("0.30");
    expect(priced.quantity).toBe("3.000");
  });
  it("rounds each line half-up before summing", () => {
    const priced = priceQuotation(
      quotationSchema.parse({
        expectedRevision: 0,
        items: [
          { ...item, quantity: "1.005", unitPrice: "1" },
          { ...item, quantity: "1.005", unitPrice: "1" },
        ],
      }),
    );
    expect(priced.amount).toBe("2.02");
  });
  it("rejects excessive discounts, zero totals and unreasoned revisions", () => {
    expect(() =>
      priceQuotation(
        quotationSchema.parse({ expectedRevision: 0, items: [{ ...item, discount: "1" }] }),
      ),
    ).toThrow();
    expect(() =>
      priceQuotation(
        quotationSchema.parse({ expectedRevision: 0, items: [{ ...item, unitPrice: "0" }] }),
      ),
    ).toThrow();
    expect(quotationSchema.safeParse({ expectedRevision: 1, items: [item] }).success).toBe(false);
  });
  it("requires a reason for showroom Not Required", () => {
    expect(
      engagementSchema.safeParse({
        kind: "showroom",
        occurredAt: new Date().toISOString(),
        outcome: "Not Required",
        notRequired: true,
      }).success,
    ).toBe(false);
  });
});
