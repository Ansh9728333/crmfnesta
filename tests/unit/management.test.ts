import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { filterSchema, dateBound, catalogConfig } from "../../src/lib/management/validation";
import { csvCell, encodeReport } from "../../src/lib/management/export";
describe("management filter and export boundaries", () => {
  it("validates financial years, inclusive IST dates and reversed ranges", () => {
    expect(
      filterSchema.safeParse({ financialYear: "2026-27", from: "2026-04-01", to: "2027-03-31" })
        .success,
    ).toBe(true);
    expect(filterSchema.safeParse({ financialYear: "2026-28" }).success).toBe(false);
    expect(filterSchema.safeParse({ from: "2026-05-02", to: "2026-05-01" }).success).toBe(false);
    expect(dateBound("2026-04-01").toISOString()).toBe("2026-03-31T18:30:00.000Z");
    expect(dateBound("2026-04-01", true).toISOString()).toBe("2026-04-01T18:30:00.000Z");
  });
  it("neutralizes spreadsheet formulas and quotes commas, newlines and Unicode", () => {
    for (const value of ["=1+1", " @SUM(A1)", "\t-1", "+cmd", "-2"]) {
      expect(csvCell(value)).toMatch(/^"'/);
    }
    expect(csvCell('IBAX, "customer"\nनमस्ते')).toBe('"IBAX, ""customer""\nनमस्ते"');
  });
  it("writes a real Excel workbook with exact decimal text and literal formulas", async () => {
    const bytes = await encodeReport(
      {
        title: "Report",
        columns: { name: "Customer", amount: "Amount INR" },
        rows: [{ name: "=1+1", amount: "999999999999.99" }],
        filters: {},
      },
      "xlsx",
    );
    expect(bytes[0]).toBe(80);
    expect(bytes[1]).toBe(75);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(bytes).buffer);
    const sheet = workbook.getWorksheet("Report")!;
    expect(sheet.getCell("A2").value).toBe("=1+1");
    expect(sheet.getCell("A2").type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getCell("B2").value).toBe("999999999999.99");
    expect(workbook.getWorksheet("Filter details")).toBeDefined();
  });
  it("bounds company payment percentages and SLA thresholds", () => {
    expect(
      catalogConfig.safeParse({
        kind: "payment_template",
        config: { percentage: "100.01", offsetDays: 0, beforeDispatch: true },
      }).success,
    ).toBe(false);
    expect(
      catalogConfig.safeParse({
        kind: "payment_template",
        config: { percentage: "40.00", offsetDays: 7, beforeDispatch: true },
      }).success,
    ).toBe(true);
    expect(
      catalogConfig.safeParse({ kind: "sla", config: { target: "audit", graceHours: -1 } }).success,
    ).toBe(false);
  });
});
