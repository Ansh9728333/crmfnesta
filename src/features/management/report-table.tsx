import Link from "next/link";
import { money, dateTime } from "@/features/leads/utils";
import type { ReportData } from "./types";
import { ExportButtons } from "./export-buttons";
export function ReportTable({ data: r, exports = true }: { data: ReportData; exports?: boolean }) {
  const keys = Object.keys(r.columns),
    href = (page: number) =>
      `/reports?${new URLSearchParams({ ...r.filters, type: r.type, page: String(page) })}`;
  return (
    <section className="min-w-0 space-y-4 rounded-xl border bg-white p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">{r.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {r.total} records · Current permissions apply
          </p>
        </div>
        {exports && <ExportButtons type={r.type} filters={r.filters} />}
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-xs">
          <thead className="bg-muted/60">
            <tr>
              {keys.map((k) => (
                <th key={k} scope="col" className="whitespace-nowrap px-3 py-3 font-semibold">
                  {r.columns[k]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.rows.map((row, n) => (
              <tr key={String(row.id ?? n)} className="border-t align-top">
                {keys.map((k) => (
                  <td className="max-w-64 break-words px-3 py-3 leading-5" key={k}>
                    {row[k] === null || row[k] === undefined
                      ? "—"
                      : r.columns[k].includes("INR")
                        ? money(String(row[k]))
                        : [
                              "date",
                              "start",
                              "estimate",
                              "completed",
                              "planned",
                              "shipped",
                              "expected",
                              "started",
                              "inspection",
                              "approved",
                              "verified",
                            ].includes(k) && !Number.isNaN(new Date(String(row[k])).getTime())
                          ? dateTime(String(row[k]))
                          : String(row[k])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!r.rows.length && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No permitted records match these filters.
        </div>
      )}
      <nav aria-label="Report pagination" className="flex justify-between text-xs">
        {r.page > 1 ? <Link href={href(r.page - 1)}>Previous</Link> : <span />}
        <span>Page {r.page}</span>
        {r.page * 25 < r.total ? <Link href={href(r.page + 1)}>Next</Link> : <span />}
      </nav>
    </section>
  );
}
