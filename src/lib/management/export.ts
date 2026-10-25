import ExcelJS from "exceljs";
import type { Row } from "./queries";
export function csvCell(value: unknown) {
  const s = String(value ?? "");
  const safe = /^[\s\u0000-\u001f]*[=+@-]/u.test(s) || /^[\t\r\n]/u.test(s) ? `'${s}` : s;
  return `"${safe.replaceAll('"', '""')}"`;
}
export async function encodeReport(
  r: { title: string; columns: Record<string, string>; rows: Row[]; filters: unknown },
  format: "csv" | "xlsx",
) {
  const keys = Object.keys(r.columns);
  if (format === "csv")
    return new TextEncoder().encode(
      "\ufeff" +
        [
          Object.values(r.columns).map(csvCell).join(","),
          ...r.rows.map((row) => keys.map((k) => csvCell(row[k])).join(",")),
        ].join("\r\n") +
        "\r\n",
    );
  const book = new ExcelJS.Workbook();
  book.creator = "SiteFlow CRM";
  book.created = new Date();
  const sheet = book.addWorksheet("Report", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = keys.map((k) => ({ header: r.columns[k], key: k, width: 26 }));
  for (const row of r.rows) sheet.addRow(keys.map((k) => String(row[k] ?? "")));
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF164A3B" } };
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, r.rows.length + 1), column: keys.length },
  };
  sheet.eachRow((row) => {
    row.alignment = { vertical: "top", wrapText: true };
  });
  const meta = book.addWorksheet("Filter details");
  meta.addRows([
    ["Report", r.title],
    ["Generated at", new Date().toISOString()],
    ["Rows", r.rows.length],
    ["Filters", JSON.stringify(r.filters)],
    ["Financial precision", "INR and fractional quantities are exported as exact decimal text."],
  ]);
  meta.columns = [{ width: 24 }, { width: 110 }];
  return new Uint8Array(await book.xlsx.writeBuffer());
}
