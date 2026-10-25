import { describe, it, expect } from "vitest";
import { stageDefinitions, stageDefinition } from "../../src/lib/orders/definitions";
import {
  parseStageData,
  validateMandatory,
  stageActionSchema,
} from "../../src/lib/orders/validation";
import { postSalesStages } from "../../src/lib/domain/workflows";
import { stageData } from "../support/post-sales-data";
describe("shared post-sales validation", () => {
  it("uses the exact canonical sixteen stages", () =>
    expect(stageDefinitions.map((s) => s.name)).toEqual(postSalesStages));
  it("validates bounded typed stage data and rejects unknown fields", () => {
    expect(parseStageData(6, { loadCount: "2", loadPlan: "Actual plan" }).loadCount).toBe(2);
    expect(() => parseStageData(6, { loadCount: 0 })).toThrow();
    expect(() => parseStageData(1, { approvedBy: "forged" })).toThrow();
    expect(stageActionSchema.safeParse({ action: "skip", version: 1 }).success).toBe(false);
  });
  it("requires real group details and documents without automating group creation", () => {
    const def = stageDefinition(1);
    expect(() =>
      validateMandatory(1, stageData(1), "Recorded", def.requiredFields, 0, false),
    ).toThrow();
    expect(() =>
      validateMandatory(
        1,
        { ...stageData(1), groupLink: "https://example.test/group" },
        "Recorded",
        def.requiredFields,
        1,
        false,
      ),
    ).toThrow();
  });
  it("requires positive measured values and ordered glass checks", () => {
    expect(() =>
      parseStageData(4, { measurements: [{ label: "Width", value: "0", unit: "mm" }] }),
    ).toThrow();
    expect(() =>
      parseStageData(13, { glassTemplateApproved: true, glassTemplatePrepared: false }),
    ).toThrow();
  });
  it("allows declined reviews after a recorded request without a positive rating", () =>
    expect(() =>
      validateMandatory(
        16,
        stageData(16),
        "Customer declined",
        [...stageDefinition(16).requiredFields, "testimonial", "reviewUrl"],
        0,
        false,
      ),
    ).not.toThrow());
  it("rejects failed audit checks and future evidence dates", () => {
    expect(() =>
      validateMandatory(
        14,
        { ...stageData(14), auditPassed: false },
        "Audit issues",
        stageDefinition(14).requiredFields,
        1,
        false,
      ),
    ).toThrow();
    expect(() =>
      validateMandatory(
        1,
        { ...stageData(1), groupCreatedAt: "2099-01-01T00:00:00Z" },
        "Recorded",
        stageDefinition(1).requiredFields,
        1,
        false,
      ),
    ).toThrow();
  });
});
