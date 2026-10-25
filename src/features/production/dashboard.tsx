import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { labels, loadStatuses } from "@/lib/production/validation";
import { selectClass } from "@/features/leads/utils";
import { AllocationModal } from "./allocation-modal";
import type { LoadList, LoadPlanning } from "./types";
export function ProductionDashboard({
  result,
  planning,
}: {
  result: LoadList;
  planning?: LoadPlanning;
}) {
  const f = result.filters;
  const href = (page: number) => `/production?${new URLSearchParams({ ...f, page: String(page) })}`;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Production & fulfillment
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Production loads</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Plan quantities. Track each load through factory, site and engineer audit.
          </p>
        </div>
        <AllocationModal initial={planning} />
      </header>
      {planning && (
        <section className="space-y-4 rounded-xl border bg-white p-5">
          <Link className="font-semibold underline" href={`/orders/${planning.order.id}`}>
            {planning.order.client} · {planning.order.company}
          </Link>
          {planning.items.map((i) => (
            <div key={i.id}>
              <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs">
                <span>{i.name ?? i.description}</span>
                <span>
                  {i.allocatedQuantity} / {i.quantity} allocated ·{" "}
                  {Number(i.quantity) - Number(i.allocatedQuantity)} pending
                </span>
              </div>
              <progress
                aria-label={`${i.name ?? i.description} allocated`}
                value={Number(i.allocatedQuantity)}
                max={Number(i.quantity)}
                className="h-2 w-full accent-primary"
              />
            </div>
          ))}
        </section>
      )}
      <form className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          aria-label="Search production loads"
          name="q"
          defaultValue={f.q}
          placeholder="Customer or production order"
        />
        <select
          aria-label="Company"
          name="organizationId"
          className={selectClass}
          defaultValue={f.organizationId}
        >
          <option value="">All companies</option>
          {result.companies.map((c) => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Production status"
          name="status"
          className={selectClass}
          defaultValue={f.status}
        >
          <option value="">All statuses</option>
          {loadStatuses.map((s) => (
            <option key={s} value={s}>
              {labels[s]}
            </option>
          ))}
        </select>
        <select
          aria-label="Site readiness filter"
          name="readiness"
          className={selectClass}
          defaultValue={f.readiness}
        >
          <option value="">Ready and pending</option>
          <option value="ready">Site ready</option>
          <option value="pending">Site pending</option>
        </select>
        {f.orderId && <input type="hidden" name="orderId" value={f.orderId} />}
        <Button>Apply filters</Button>
      </form>
      <p className="text-xs text-muted-foreground">
        {result.total} matching loads · Page {f.page}
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {result.rows.map(({ load, client, company }) => (
          <Link
            key={load.id}
            href={`/production/${load.id}`}
            className="space-y-4 rounded-xl border bg-white p-5 transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Load {load.loadNumber}</h2>
              <Badge variant={load.siteReady ? "default" : "secondary"}>
                {load.siteReady ? "Site ready" : "Site pending"}
              </Badge>
            </div>
            <p className="text-sm">{client}</p>
            <p className="text-xs text-muted-foreground">
              {company} · {load.id.slice(0, 8)}
            </p>
            <progress
              aria-label="Load progress"
              className="h-2 w-full accent-primary"
              max={9}
              value={loadStatuses.indexOf(load.status as (typeof loadStatuses)[number])}
            />
            <p className="text-xs font-medium">{labels[load.status]}</p>
          </Link>
        ))}
      </div>
      {!result.rows.length && (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <h2 className="font-semibold">No matching production loads</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Choose a Won order to allocate its confirmed items, or adjust your filters.
          </p>
        </div>
      )}
      <nav className="flex gap-3" aria-label="Load pagination">
        {f.page > 1 && (
          <Button asChild variant="outline">
            <Link href={href(f.page - 1)}>Previous</Link>
          </Button>
        )}
        {f.page * 20 < result.total && (
          <Button asChild variant="outline">
            <Link href={href(f.page + 1)}>Next</Link>
          </Button>
        )}
      </nav>
    </div>
  );
}
