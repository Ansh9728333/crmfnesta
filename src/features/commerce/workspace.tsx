"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { dateTime, money, requestJson } from "@/features/leads/utils";
import type { CommerceDetail } from "./types";
import { Files, type Command } from "./shared";
import { PaymentsPanel } from "./payments-panel";
import { ShippingPanel } from "./shipping-panel";
export function CommerceWorkspace({
  detail: d,
  mode,
}: {
  detail: CommerceDetail;
  mode: "payments" | "dispatch";
}) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const endpoint = `/api/commerce/orders/${d.order.id}`;
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const command: Command = (body) =>
    run(async () => {
      await requestJson(endpoint, "PATCH", body);
    });
  const filePanel = (
    kind: "payment" | "dispatch" | "delivery",
    target: string,
    canUpload: boolean,
  ) => (
    <Files
      d={d}
      kind={kind}
      target={target}
      canUpload={canUpload}
      busy={busy}
      onError={setError}
      onUpload={(file) =>
        run(async () => {
          const form = new FormData();
          form.set("file", file);
          const response = await fetch(`${endpoint}/files?kind=${kind}&target=${target}`, {
            method: "POST",
            body: form,
          });
          if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error ?? "Upload failed");
          }
        })
      }
    />
  );
  return (
    <div className="space-y-6 [overflow-wrap:anywhere]">
      <Link href={`/${mode}`} className="text-sm underline">
        ← {mode === "payments" ? "Payment dashboard" : "Dispatch dashboard"}
      </Link>
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          {d.order.company}
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{d.order.client}</h1>
        <p className="mt-3 break-all text-xs text-muted-foreground">Order {d.order.id}</p>
        <nav className="mt-4 flex flex-wrap gap-5 text-sm underline">
          <Link href={`/payments?orderId=${d.order.id}`}>Payments</Link>
          <Link href={`/dispatch?orderId=${d.order.id}`}>Dispatch & delivery</Link>
          <Link href={`/production?orderId=${d.order.id}`}>Production loads</Link>
          <Link href={`/orders/${d.order.id}`}>Order workflow</Link>
        </nav>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Order value", d.order.finalValue],
          ["Reported receipts", d.totals.received],
          ["Verified received", d.totals.verified],
          ["Outstanding balance", d.totals.outstanding],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-white p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-3 text-lg font-semibold">{money(value)}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Outstanding balance uses verified receipts. Pending receipts remain reported and cannot fund
        dispatch.
      </p>
      {mode === "payments" ? (
        <PaymentsPanel d={d} command={command} busy={busy} filePanel={filePanel} />
      ) : (
        <ShippingPanel d={d} command={command} busy={busy} filePanel={filePanel} />
      )}
      <section className="space-y-4 rounded-xl border bg-white p-5">
        <h2 className="font-semibold">Financial & material audit history</h2>
        {d.events.map((e) => (
          <article key={e.id} className="space-y-2 border-l-2 border-primary/30 pl-4 text-xs">
            <strong>{e.action}</strong>
            <p className="whitespace-pre-wrap break-words">{e.notes}</p>
            <p className="break-all text-muted-foreground">
              {dateTime(e.createdAt)} · Employee {e.actorId}
            </p>
          </article>
        ))}
        {!d.events.length && (
          <p className="text-sm text-muted-foreground">
            No ledger or shipping activity recorded yet.
          </p>
        )}
        <nav className="flex gap-4 text-xs underline">
          {d.historyPage > 1 && (
            <Link href={`/${mode}?orderId=${d.order.id}&historyPage=${d.historyPage - 1}`}>
              Newer activity
            </Link>
          )}
          {d.historyPage * 20 < d.historyTotal && (
            <Link href={`/${mode}?orderId=${d.order.id}&historyPage=${d.historyPage + 1}`}>
              Older activity
            </Link>
          )}
        </nav>
      </section>
    </div>
  );
}
