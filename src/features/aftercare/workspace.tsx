"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dateTime, requestJson } from "@/features/leads/utils";
import { Installation } from "./installation";
import { Audit } from "./audit";
import { Closure } from "./closure";
import { Evidence, type Run, type Files } from "./shared";
import type { Detail } from "./types";
export function AftercareWorkspace({ d, mode }: { d: Detail; mode: "installations" | "service" }) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [pending, startTransition] = useTransition(),
    [error, setError] = useState("");
  async function refresh(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const run: Run = (body) =>
    refresh(async () => {
      await requestJson(`/api/aftercare/orders/${d.order.id}`, "PATCH", body);
    });
  const files: Files = (kind, target, enabled) => (
    <Evidence
      key={`${kind}-${target}`}
      d={d}
      kind={kind}
      target={target}
      enabled={enabled}
      busy={busy || pending}
      refresh={refresh}
      error={setError}
    />
  );
  const completed = d.installations.filter((i) => i.status === "completed").length,
    approved = d.audits.filter((a) => a.status === "approved").length;
  return (
    <div className="space-y-6">
      <header>
        <Link className="text-sm underline" href={`/${mode}`}>
          ← {mode === "installations" ? "Installation dashboard" : "Service dashboard"}
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-primary">
          {d.order.company}
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{d.order.client}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "installations"
            ? "Installation, quality audit & handover"
            : "Feedback & customer service"}
        </p>
        <nav className="mt-4 flex flex-wrap gap-4 text-sm underline">
          <Link href={`/orders/${d.order.id}`}>Order workflow</Link>
          <Link href={`/installations?orderId=${d.order.id}`}>Site work</Link>
          <Link href={`/service?orderId=${d.order.id}`}>Customer service</Link>
          <Link href={`/dispatch?orderId=${d.order.id}`}>Delivery records</Link>
        </nav>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {pending && (
        <p role="status" className="text-sm">
          Refreshing saved records…
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Production loads", d.loads.length],
          ["Installations complete", completed],
          ["Audits approved", approved],
          ["Handover", d.handover?.status ?? "Not prepared"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-white p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 text-xl font-semibold capitalize">{value}</p>
          </div>
        ))}
      </div>
      {mode === "installations" && (
        <>
          <div className="grid items-start gap-6 xl:grid-cols-2">
            {d.loads.map((load) => (
              <Installation
                key={load.id}
                d={d}
                load={load}
                busy={busy || pending}
                run={run}
                files={files}
              />
            ))}
          </div>
          {!d.loads.length && (
            <p className="rounded-xl border border-dashed p-8 text-sm">
              Create and deliver production loads before starting installation.
            </p>
          )}
          <div className="grid items-start gap-6 xl:grid-cols-2">
            {d.installations.map((i) => (
              <Audit key={i.id} d={d} i={i} busy={busy || pending} run={run} files={files} />
            ))}
          </div>
        </>
      )}
      <Closure d={d} run={run} busy={busy || pending} files={files} />
      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold">Site work & service timeline</h2>
        <ol className="mt-5 space-y-4 border-l pl-5">
          {d.events.map((e) => (
            <li key={e.id} className="space-y-1">
              <p className="text-sm font-medium capitalize">
                {e.action.replaceAll(".", " · ").replaceAll("_", " ")}
              </p>
              <p className="text-xs text-muted-foreground">
                {dateTime(e.createdAt)} ·{" "}
                {d.employees.find((p) => p.id === e.actorId)?.name ?? "Recorded employee"}
              </p>
              <p className="break-words text-sm">{e.notes}</p>
            </li>
          ))}
        </ol>
        {!d.events.length && (
          <p className="mt-3 text-sm text-muted-foreground">No site work recorded yet.</p>
        )}
        <nav aria-label="Activity pagination" className="mt-5 flex justify-between text-sm">
          {d.historyPage > 1 ? (
            <Link href={`/${mode}?orderId=${d.order.id}&historyPage=${d.historyPage - 1}`}>
              Newer activity
            </Link>
          ) : (
            <span />
          )}
          <span>{d.historyTotal} events</span>
          {d.historyPage * 20 < d.historyTotal ? (
            <Link href={`/${mode}?orderId=${d.order.id}&historyPage=${d.historyPage + 1}`}>
              Older activity
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </section>
    </div>
  );
}
