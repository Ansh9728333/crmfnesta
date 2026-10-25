"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Labeled } from "@/features/orders/fields";
import { dateTime, localInput, requestJson, selectClass, utcInput } from "@/features/leads/utils";
import { labels, loadStatuses } from "@/lib/production/validation";
import { AllocationModal } from "./allocation-modal";
import type { LoadDetail } from "./types";
export function LoadWorkspace({ detail: d }: { detail: LoadDetail }) {
  const router = useRouter(),
    l = d.load,
    index = loadStatuses.indexOf(l.status as (typeof loadStatuses)[number]),
    target = loadStatuses[index + 1];
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reference, setReference] = useState(""),
    [notes, setNotes] = useState(""),
    [date, setDate] = useState(""),
    [estimate, setEstimate] = useState(""),
    [glass, setGlass] = useState(""),
    [checks, setChecks] = useState([false, false, false]);
  async function change(body: unknown) {
    setBusy(true);
    setError("");
    try {
      await requestJson(`/api/production/${l.id}`, "PATCH", body);
      setReference("");
      setNotes("");
      setDate("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const canAdvance =
    target === "audit_passed"
      ? d.permissions.audit
      : ["installation_started", "installed"].includes(target)
        ? d.permissions.installation
        : d.permissions.production;
  const refLabel =
    target === "released"
      ? "Production order number"
      : target === "dispatched"
        ? "Dispatch reference and carrier"
        : target === "delivered"
          ? "Delivery confirmation and received by"
          : target === "audit_passed"
            ? "Passed engineer audit reference"
            : "Activity reference / confirmation";
  return (
    <div className="space-y-6">
      <Link href={`/production?orderId=${l.orderId}`} className="text-sm underline">
        ← Order production loads
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {d.order.company} · {d.order.client}
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Load {l.loadNumber}</h1>
          <p className="mt-3 break-all text-xs text-muted-foreground">Load ID {l.id}</p>
          <Link className="mt-2 inline-block text-xs underline" href={`/orders/${l.orderId}`}>
            View related order
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>{labels[l.status]}</Badge>
          <Badge variant={l.siteReady ? "default" : "secondary"}>
            {l.siteReady ? "Site ready" : "Site pending"}
          </Badge>
          {l.status === "planned" && d.canManage && <AllocationModal detail={d} />}
        </div>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <section className="space-y-4 rounded-xl border bg-white p-5">
            <h2 className="font-semibold">Order item allocation</h2>
            {d.items.map((item) => {
              const own = d.allocations.find((a) => a.orderItemId === item.id)?.quantity ?? "0";
              return (
                <div key={item.id}>
                  <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs">
                    <strong>{item.name ?? item.description}</strong>
                    <span>
                      This load {own} · Confirmed {item.quantity}
                    </span>
                  </div>
                  <progress
                    className="h-2 w-full accent-primary"
                    aria-label={`${item.name ?? item.description} total allocation`}
                    value={Number(item.allocatedQuantity)}
                    max={Number(item.quantity)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.allocatedQuantity} allocated across loads ·{" "}
                    {Number(item.quantity) - Number(item.allocatedQuantity)} unallocated
                  </p>
                </div>
              );
            })}
            {!d.allocations.length && (
              <p className="text-sm text-muted-foreground">
                This is an empty planning draft. Allocate confirmed items before release.
              </p>
            )}
          </section>
          {l.status === "planned" && d.permissions.production && (
            <form
              className="space-y-3 rounded-xl border bg-white p-5"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void change({
                  action: "readiness",
                  version: l.version,
                  siteReady: f.get("ready") === "yes",
                  notes: f.get("notes"),
                });
              }}
            >
              <h2 className="font-semibold">Site readiness</h2>
              <Labeled label="Ready for this load">
                {(id) => (
                  <select
                    id={id}
                    name="ready"
                    defaultValue={l.siteReady ? "yes" : "no"}
                    className={selectClass}
                  >
                    <option value="no">No — pending</option>
                    <option value="yes">Yes — ready</option>
                  </select>
                )}
              </Labeled>
              <Labeled label="Readiness observations">
                {(id) => <Input id={id} name="notes" required maxLength={2000} />}
              </Labeled>
              <Button disabled={busy}>Save readiness</Button>
            </form>
          )}
          <Link className="block text-sm underline" href={`/installations?orderId=${l.orderId}`}>
            Manage installation, engineer audit and handover
          </Link>
          {target &&
            canAdvance &&
            ![
              "dispatched",
              "delivered",
              "installation_started",
              "installed",
              "audit_passed",
              "completed",
            ].includes(target) && (
              <form
                className="space-y-4 rounded-xl border bg-white p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void change({
                    action: "advance",
                    version: l.version,
                    target,
                    occurredAt: utcInput(date),
                    reference,
                    notes,
                    ...(target === "in_production" ? { estimatedAt: utcInput(estimate) } : {}),
                    ...(target === "installation_started" && d.order.companySlug === "s-grip"
                      ? { glassRequired: glass === "yes" }
                      : {}),
                    ...(target === "installed"
                      ? {
                          glassMeasurementTaken: checks[0],
                          glassTemplatePrepared: checks[1],
                          glassTemplateApproved: checks[2],
                        }
                      : {}),
                  });
                }}
              >
                <h2 className="font-semibold">Next: {labels[target]}</h2>
                <p className="text-xs text-muted-foreground">
                  Record actual evidence. Each load moves independently; completing this load
                  preserves the parent order workflow.
                </p>
                <Labeled label={refLabel}>
                  {(id) => (
                    <Input
                      id={id}
                      required
                      maxLength={2000}
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                  )}
                </Labeled>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Labeled label="Actual activity date and time (IST)">
                    {(id) => (
                      <Input
                        id={id}
                        required
                        type="datetime-local"
                        max={localInput(new Date())}
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                      />
                    )}
                  </Labeled>
                  {target === "in_production" && (
                    <Labeled label="Estimated factory completion (IST)">
                      {(id) => (
                        <Input
                          id={id}
                          required
                          type="datetime-local"
                          value={estimate}
                          onChange={(e) => setEstimate(e.target.value)}
                        />
                      )}
                    </Labeled>
                  )}
                </div>
                {target === "installation_started" && d.order.companySlug === "s-grip" && (
                  <Labeled label="Glass Required">
                    {(id) => (
                      <select
                        required
                        id={id}
                        className={selectClass}
                        value={glass}
                        onChange={(e) => setGlass(e.target.value)}
                      >
                        <option value="">Select Yes or No</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    )}
                  </Labeled>
                )}
                {target === "installed" && l.data.glassRequired === true && (
                  <fieldset className="space-y-3 rounded-lg border p-4">
                    <legend className="text-xs font-semibold">
                      S-Grip glass checks within this order
                    </legend>
                    {[
                      "Glass Measurement Taken",
                      "Glass Template Prepared",
                      "Glass Template Approved",
                    ].map((label, i) => (
                      <label key={label} className="flex gap-3 text-sm">
                        <input
                          type="checkbox"
                          required
                          checked={checks[i]}
                          disabled={i > 0 && !checks[i - 1]}
                          onChange={(e) =>
                            setChecks(
                              checks.map((v, k) =>
                                k === i ? e.target.checked : k > i ? false : v,
                              ),
                            )
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </fieldset>
                )}
                <Labeled label="Activity notes">
                  {(id) => (
                    <textarea
                      id={id}
                      required
                      maxLength={2000}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="min-h-20 w-full rounded-md border p-3 text-sm"
                    />
                  )}
                </Labeled>
                <Button disabled={busy}>Confirm {labels[target]}</Button>
              </form>
            )}
          <section className="space-y-3 rounded-xl border bg-white p-5 text-sm">
            <h2 className="font-semibold">Payments and shipping</h2>
            <p className="text-xs text-muted-foreground">
              Verified installments, load allocations, approved dispatches and delivery
              confirmations are maintained in the order ledger.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link className="underline" href={`/payments?orderId=${l.orderId}`}>
                Payment ledger
              </Link>
              <Link className="underline" href={`/dispatch?orderId=${l.orderId}`}>
                Dispatch and delivery
              </Link>
            </div>
          </section>
          <section className="space-y-4 rounded-xl border bg-white p-5">
            <h2 className="font-semibold">Load activity history</h2>
            {d.events.map((event) => (
              <article key={event.id} className="border-l-2 border-primary/30 pl-4 text-xs">
                <strong>{event.action}</strong>
                <p className="mt-2 whitespace-pre-wrap break-words">{event.notes}</p>
                <p className="mt-2 text-muted-foreground">
                  {dateTime(event.createdAt)} · Employee {event.actorId}
                </p>
              </article>
            ))}
            {!d.events.length && (
              <p className="text-xs text-muted-foreground">
                Planning draft created by the order workflow. Subsequent load activity appears here.
              </p>
            )}
            <div className="flex gap-3">
              {d.historyPage > 1 && (
                <Link className="text-xs underline" href={`?historyPage=${d.historyPage - 1}`}>
                  Newer activity
                </Link>
              )}
              {d.historyPage * 20 < d.historyTotal && (
                <Link className="text-xs underline" href={`?historyPage=${d.historyPage + 1}`}>
                  Older activity
                </Link>
              )}
            </div>
          </section>
        </div>
        <aside className="min-w-0 space-y-5">
          <section className="space-y-4 rounded-xl border bg-white p-5">
            <h2 className="font-semibold">Production status timeline</h2>
            {loadStatuses.map((s, i) => (
              <div key={s} className="flex gap-3">
                <span
                  className={`mt-1 h-3 w-3 shrink-0 rounded-full ${i <= index ? "bg-primary" : "bg-muted"}`}
                />
                <div className="min-w-0 text-xs">
                  <strong>
                    {labels[s]}
                    {i === index ? " · current" : ""}
                  </strong>
                  {typeof l.data[`${s}At`] === "string" && (
                    <p className="mt-2 text-muted-foreground">
                      {dateTime(String(l.data[`${s}At`]))}
                    </p>
                  )}
                  {typeof l.data[`${s}Reference`] === "string" && (
                    <p className="mt-2 break-words">{String(l.data[`${s}Reference`])}</p>
                  )}
                </div>
              </div>
            ))}
          </section>
          <section className="space-y-3 rounded-xl border bg-white p-5 text-xs">
            <h2 className="text-sm font-semibold">Load facts</h2>
            <p>
              Owner:{" "}
              {d.employees.find((p) => p.id === l.assignedTo)?.name ?? "Not assigned / inactive"}
            </p>
            <p>Factory estimate: {dateTime(l.data.estimatedCompletionAt as string | undefined)}</p>
            <Link className="block underline" href={`/payments?orderId=${l.orderId}`}>
              View current verified payment ledger
            </Link>
            <p>Completed: {dateTime(l.completedAt)}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
