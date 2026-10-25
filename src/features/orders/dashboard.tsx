import Link from "next/link";
import { AlertCircle, ArrowUpRight, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { dateTime, money, selectClass } from "@/features/leads/utils";
import { postSalesStages } from "@/lib/domain/workflows";
import type { OrderList } from "./types";
export function OrderDashboard({
  result,
  filters,
}: {
  result: OrderList;
  filters: { q: string; organizationId: string; status: string; page: number };
}) {
  const href = (page: number) =>
    `/orders?${new URLSearchParams({ ...filters, page: String(page) })}`;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Shared post-sales workflow
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Every order, through to handover.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            One sixteen-stage process for Finesta Home, IBAX and S-Grip.
          </p>
        </div>
        {result.canConfigure && (
          <Button asChild variant="outline">
            <Link href="/orders/settings">
              <SlidersHorizontal size={15} />
              Stage configuration
            </Link>
          </Button>
        )}
      </header>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Active orders", result.totals.active],
          ["Completed", result.totals.completed],
          ["Overdue tasks", result.totals.overdue],
          ["Unassigned stages", result.totals.unassigned],
          ["Awaiting approval", result.totals.awaiting],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-white p-5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <strong className="mt-3 block text-2xl">{value}</strong>
          </div>
        ))}
      </div>
      {(result.totals.overdue > 0 ||
        result.totals.unassigned > 0 ||
        result.totals.awaiting > 0) && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-primary/20 bg-accent p-4 text-sm"
        >
          <AlertCircle size={19} className="shrink-0 text-primary" />
          <p>
            Pending task alerts: {result.totals.overdue} overdue, {result.totals.unassigned} without
            an owner, {result.totals.awaiting} awaiting review. Open an order to resolve its current
            task.
          </p>
        </div>
      )}
      <form className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
        <Input
          name="q"
          aria-label="Search orders"
          defaultValue={filters.q}
          placeholder="Customer or project"
        />
        <select
          name="organizationId"
          aria-label="Company filter"
          className={selectClass}
          defaultValue={filters.organizationId}
        >
          <option value="">All companies</option>
          {result.companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          name="status"
          aria-label="Task filter"
          className={selectClass}
          defaultValue={filters.status}
        >
          {[
            ["", "All orders"],
            ["active", "Active"],
            ["completed", "Completed"],
            ["overdue", "Overdue"],
            ["unassigned", "Unassigned"],
            ["awaiting_approval", "Awaiting approval"],
            ["mine", "My current tasks"],
          ].map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Button>Apply filters</Button>
      </form>
      <section className="rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="font-semibold">Order management</h2>
          <span className="text-xs text-muted-foreground">{result.totals.total} orders</span>
        </div>
        {!result.rows.length ? (
          <div className="space-y-4 px-5 py-16 text-center">
            <h3 className="font-semibold">No orders match these filters</h3>
            <p className="text-sm text-muted-foreground">
              Orders appear after a quotation-backed Won conversion.
            </p>
            <Button asChild variant="outline">
              <Link href="/leads">Open sales pipeline</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-background text-muted-foreground">
                <tr>
                  {[
                    "Customer / project",
                    "Company",
                    "Current stage",
                    "Status",
                    "Owner / target",
                    "Value",
                    "",
                  ].map((label, i) => (
                    <th className="p-4" key={i}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="min-w-44 p-4">
                      <strong>{o.client}</strong>
                      <p className="mt-2 text-muted-foreground">
                        {o.project ?? "Project not linked"}
                      </p>
                    </td>
                    <td className="p-4">{o.company}</td>
                    <td className="min-w-48 p-4">
                      {o.stage}. {postSalesStages[o.stage - 1]}
                    </td>
                    <td className="p-4">
                      <Badge variant="outline">
                        {o.completedAt
                          ? "Completed"
                          : (o.stageStatus ?? "Needs initialization").replaceAll("_", " ")}
                      </Badge>
                    </td>
                    <td className="min-w-44 p-4">
                      {o.assignedName ?? "Unassigned"}
                      <p className="mt-2 text-muted-foreground">
                        {o.plannedAt ? dateTime(o.plannedAt) : "Target not set"}
                      </p>
                    </td>
                    <td className="p-4 whitespace-nowrap">{money(o.finalValue)}</td>
                    <td className="p-4">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/orders/${o.id}`}>
                          Open <ArrowUpRight size={13} />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {filters.page > 1 ? (
          <Button asChild variant="outline">
            <Link href={href(filters.page - 1)}>Previous</Link>
          </Button>
        ) : (
          <Button disabled variant="outline">
            Previous
          </Button>
        )}
        <span className="text-xs text-muted-foreground">Page {filters.page}</span>
        {filters.page * 20 < result.totals.total ? (
          <Button asChild variant="outline">
            <Link href={href(filters.page + 1)}>Next</Link>
          </Button>
        ) : (
          <Button disabled variant="outline">
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
