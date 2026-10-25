"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Labeled } from "@/features/orders/fields";
import { requestJson, selectClass } from "@/features/leads/utils";
import type { LoadDetail, LoadPlanning } from "./types";
export function AllocationModal({
  initial,
  detail,
}: {
  initial?: LoadPlanning;
  detail?: LoadDetail;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [plan, setPlan] = useState<LoadPlanning | undefined>(initial ?? detail),
    [search, setSearch] = useState(""),
    [options, setOptions] = useState<{ id: string; client: string }[]>([]),
    [quantities, setQuantities] = useState<Record<string, string>>(
      Object.fromEntries(detail?.allocations.map((a) => [a.orderItemId, a.quantity]) ?? []),
    ),
    [assigned, setAssigned] = useState(detail?.load.assignedTo ?? ""),
    [ready, setReady] = useState(detail?.load.siteReady ?? false),
    [notes, setNotes] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={detail ? "outline" : "default"}>
          {detail ? "Edit allocation" : "Create load"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {detail ? `Allocate Load ${detail.load.loadNumber}` : "Create production load"}
          </DialogTitle>
          <DialogDescription>
            Allocate individual confirmed items. Unallocated quantities remain pending for later
            loads.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              if (!plan) throw new Error("Choose a Won order");
              const body = {
                orderId: plan.order.id,
                assignedTo: assigned,
                siteReady: ready,
                notes,
                allocations: Object.entries(quantities)
                  .filter(([, v]) => v && Number(v) > 0)
                  .map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
              };
              const result = await requestJson<{ id: string }>(
                detail ? `/api/production/${detail.load.id}` : "/api/production",
                detail ? "PATCH" : "POST",
                detail ? { action: "allocate", version: detail.load.version, plan: body } : body,
              );
              setOpen(false);
              router.push(`/production/${result.id}`);
              router.refresh();
            });
          }}
        >
          {!initial && !detail && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Labeled label="Find Won order">
                  {(id) => (
                    <Input
                      id={id}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Customer name"
                    />
                  )}
                </Labeled>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-6"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const result = await requestJson<{ rows: { id: string; client: string }[] }>(
                        `/api/orders?q=${encodeURIComponent(search)}`,
                      );
                      setOptions(result.rows);
                    })
                  }
                >
                  Search
                </Button>
              </div>
              <Labeled label="Related order">
                {(id) => (
                  <select
                    id={id}
                    className={selectClass}
                    value={plan?.order.id ?? ""}
                    onChange={(e) =>
                      void run(async () => {
                        setPlan(
                          await requestJson<LoadPlanning>(
                            `/api/production/planning/${e.target.value}`,
                          ),
                        );
                        setQuantities({});
                        setAssigned("");
                      })
                    }
                  >
                    <option value="">Select an order</option>
                    {options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.client} · {o.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                )}
              </Labeled>
            </div>
          )}
          {plan && (
            <>
              <p className="text-sm font-semibold">
                {plan.order.company} · {plan.order.client}
              </p>
              {!plan.canManage && (
                <p role="alert">Your role cannot manage production for this order.</p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Labeled label="Assigned production employee">
                  {(id) => (
                    <select
                      required
                      id={id}
                      className={selectClass}
                      value={assigned}
                      onChange={(e) => setAssigned(e.target.value)}
                    >
                      <option value="">Select employee</option>
                      {[...new Map(plan.employees.map((p) => [p.id, p])).values()].map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                </Labeled>
                <Labeled label="Site readiness">
                  {(id) => (
                    <select
                      id={id}
                      className={selectClass}
                      value={ready ? "ready" : "pending"}
                      onChange={(e) => setReady(e.target.value === "ready")}
                    >
                      <option value="pending">Pending site readiness</option>
                      <option value="ready">Ready for this load</option>
                    </select>
                  )}
                </Labeled>
              </div>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted">
                    <tr>
                      {[
                        "Order item",
                        "Confirmed",
                        "Allocated elsewhere",
                        "Available",
                        "This load",
                      ].map((h) => (
                        <th className="p-3" key={h}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {plan.items.map((item) => {
                      const own =
                          detail?.allocations.find((a) => a.orderItemId === item.id)?.quantity ??
                          "0",
                        elsewhere = new Decimal(item.allocatedQuantity).minus(own),
                        available = new Decimal(item.quantity).minus(elsewhere);
                      return (
                        <tr className="border-t" key={item.id}>
                          <td className="min-w-36 p-3">{item.name ?? item.description}</td>
                          <td className="p-3">{item.quantity}</td>
                          <td className="p-3">{elsewhere.toString()}</td>
                          <td className="p-3">{available.toString()}</td>
                          <td className="min-w-28 p-3">
                            <Input
                              aria-label={`Allocate ${item.name ?? item.description}`}
                              type="number"
                              min="0"
                              max={available.toString()}
                              step="0.001"
                              value={quantities[item.id] ?? ""}
                              onChange={(e) =>
                                setQuantities({ ...quantities, [item.id]: e.target.value })
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <Labeled label="Allocation notes">
            {(id) => (
              <textarea
                required
                maxLength={2000}
                id={id}
                className="min-h-20 w-full rounded-md border p-3 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            )}
          </Labeled>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button disabled={busy || !plan?.canManage} type="submit">
            {busy ? "Saving…" : "Save allocation"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
