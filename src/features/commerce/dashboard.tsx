import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { money, selectClass } from "@/features/leads/utils";
import type { CommerceList } from "./types";
export function CommerceDashboard({
  result,
  mode,
}: {
  result: CommerceList;
  mode: "payments" | "dispatch";
}) {
  const f = result.filters,
    href = (page: number) => `/${mode}?${new URLSearchParams({ ...f, page: String(page) })}`;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Accounts & fulfillment
        </p>
        <h1 className="mt-2 text-3xl font-semibold">
          {mode === "payments" ? "Payment management" : "Dispatch & delivery"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {mode === "payments"
            ? "Track installments, verify receipts and fund each load's contractual milestones."
            : "Approve material movements and confirm actual site receipts, including partial deliveries."}
        </p>
      </header>
      <form className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          aria-label="Search customer or order"
          name="q"
          placeholder="Customer or order ID"
          defaultValue={f.q}
        />
        <select
          name="organizationId"
          aria-label="Company"
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
          name="status"
          aria-label="Ledger status"
          className={selectClass}
          defaultValue={f.status}
        >
          <option value="">All orders</option>
          {(mode === "payments"
            ? [
                ["pending", "Pending verification"],
                ["outstanding", "Outstanding balance"],
              ]
            : [
                ["partial", "Partial delivery"],
                ["delivered", "Delivered shipments"],
              ]
          ).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <Button>Apply filters</Button>
      </form>
      <p className="text-xs text-muted-foreground">
        {result.total} matching orders · Page {f.page}
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {result.rows.map((r) => (
          <Link
            key={r.id}
            href={`/${mode}?orderId=${r.id}`}
            className="space-y-4 rounded-xl border bg-white p-5 hover:shadow-md"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <h2 className="font-semibold">{r.client}</h2>
              <span className="text-xs text-muted-foreground">{r.company}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              {[
                ["Order value", money(r.value)],
                ["Verified receipts", money(r.verified)],
                ["Outstanding", money(r.outstanding)],
                ["Shipments / pending approval", `${r.shipments} / ${r.pendingApprovals}`],
              ].map(([l, v]) => (
                <div key={l}>
                  <p className="text-muted-foreground">{l}</p>
                  <p className="mt-2 font-semibold">{v}</p>
                </div>
              ))}
            </div>
            <p className="text-xs font-medium text-primary">
              {mode === "payments" ? "Open payment ledger" : "Open shipment workspace"} →
            </p>
          </Link>
        ))}
      </div>
      {!result.rows.length && (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <h2 className="font-semibold">No matching Won orders</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Adjust your filters or ask your administrator about assigned order access.
          </p>
        </div>
      )}
      <nav className="flex gap-3">
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
