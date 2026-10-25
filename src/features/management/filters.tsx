import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { selectClass } from "@/features/leads/utils";
import type { Directory } from "./types";
import { reports, type Filters, type Report } from "@/lib/management/validation";
import { reportStatuses } from "@/lib/management/service";
export function ManagementFilters({
  directory: d,
  f,
  type,
}: {
  directory: Directory;
  f: Filters;
  type?: Report;
}) {
  const statuses = type ? reportStatuses[type] : ["active", "won", "lost", "completed"];
  return (
    <form
      className="grid gap-4 rounded-xl border bg-white p-5 sm:grid-cols-2 xl:grid-cols-4"
      aria-label="Management filters"
    >
      {type && (
        <label className="space-y-2 text-xs font-medium">
          Report
          <select name="type" className={selectClass} defaultValue={type}>
            {Object.entries(reports)
              .filter(([key]) => key !== "payments" || d.financial)
              .map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
          </select>
        </label>
      )}
      <label className="space-y-2 text-xs font-medium">
        Company
        <select name="organizationId" className={selectClass} defaultValue={f.organizationId}>
          <option value="">All authorized companies</option>
          {d.companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-2 text-xs font-medium">
        Financial Year
        <Input
          name="financialYear"
          placeholder="YYYY-YY"
          list="management-financial-years"
          defaultValue={f.financialYear}
        />
        <datalist id="management-financial-years">
          {d.financialYears.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </datalist>
      </label>
      <label className="space-y-2 text-xs font-medium">
        From (IST)
        <Input name="from" type="date" defaultValue={f.from} />
      </label>
      <label className="space-y-2 text-xs font-medium">
        To (IST, inclusive)
        <Input name="to" type="date" defaultValue={f.to} />
      </label>
      <label className="space-y-2 text-xs font-medium">
        Territory
        <Input name="territory" list="management-territories" defaultValue={f.territory} />
        <datalist id="management-territories">
          {d.territories.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </datalist>
      </label>
      <label className="space-y-2 text-xs font-medium">
        Sales Executive
        <select name="executiveId" className={selectClass} defaultValue={f.executiveId}>
          <option value="">All permitted executives</option>
          {d.employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-2 text-xs font-medium">
        Status
        <select name="status" className={selectClass} defaultValue={f.status}>
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end gap-3">
        <Button>Apply filters</Button>
        <a href={type ? `/reports?type=${type}` : "/"} className="pb-2 text-xs underline">
          Clear filters
        </a>
      </div>
    </form>
  );
}
