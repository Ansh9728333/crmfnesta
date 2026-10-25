"use client";
import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { dateTime, money, requestJson } from "@/features/leads/utils";
import { postSalesStages } from "@/lib/domain/workflows";
import { StageEditor } from "./stage-editor";
import { StageDocuments } from "./documents-panel";
import { WorkflowTimeline } from "./timeline";
import type { OrderDetail } from "./types";
export function OrderWorkspace({ initial }: { initial: OrderDetail }) {
  const [detail, setDetail] = useState(initial),
    [selected, setSelected] = useState(initial.fileStage),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const stage = detail.stages.find((s) => s.number === selected),
    completed = detail.stages.filter((s) => s.status === "completed").length;
  async function reload(patch: { stage?: number; historyPage?: number; filePage?: number } = {}) {
    const number = patch.stage ?? selected,
      params = new URLSearchParams({
        fileStage: String(number),
        filePage: String(patch.filePage ?? 1),
        historyPage: String(patch.historyPage ?? detail.historyPage),
      });
    const result = await requestJson<OrderDetail>(`/api/orders/${detail.order.id}?${params}`);
    setDetail(result);
    setSelected(number);
  }
  async function run(action: string, data: Record<string, unknown> = {}) {
    if (!stage) return;
    setBusy(true);
    setError("");
    try {
      await requestJson(`/api/orders/${detail.order.id}/stages/${stage.number}`, "POST", {
        action,
        version: stage.version,
        ...data,
      });
      await reload();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function changeStage(number: number) {
    setBusy(true);
    setError("");
    reload({ stage: number })
      .then(() => window.history.replaceState(null, "", `?stage=${number}`))
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }
  const current = detail.stages.find((s) => s.number === detail.order.stage),
    overdue =
      current?.plannedAt && !detail.order.completedAt && new Date(current.plannedAt) < new Date();
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link className="text-xs font-semibold text-primary" href="/orders">
            ← Order management
          </Link>
          <p className="mt-4 text-xs text-muted-foreground">
            {detail.order.company} · {detail.order.project ?? "Project not linked"}
          </p>
          <h1 className="mt-2 break-words text-3xl font-semibold">{detail.order.client}</h1>
          <p className="mt-3 text-xs text-muted-foreground">
            <span className="break-all">Order {detail.order.id}</span>{" "}
            <span className="inline-block">· {dateTime(detail.order.createdAt)}</span>
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/leads/${detail.order.leadId}/presales?tab=conversion`}>
            Pre-sales history
          </Link>
        </Button>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-white p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-5">
          <p className="text-xs text-muted-foreground">Final order value</p>
          <strong className="mt-2 block text-xl">{money(detail.order.finalValue)}</strong>
          <p className="mt-2 text-xs">
            Final quantity: {detail.order.finalQuantity ?? "Not recorded"}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <p className="text-xs text-muted-foreground">Current post-sales stage</p>
          <strong className="mt-2 block text-sm">
            {detail.order.stage}. {postSalesStages[detail.order.stage - 1]}
          </strong>
          <Badge variant="outline" className="mt-3">
            {detail.order.completedAt
              ? "Completed"
              : (current?.status ?? "Needs initialization").replaceAll("_", " ")}
          </Badge>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <p className="text-xs text-muted-foreground">Approved progress</p>
          <strong className="mt-2 block text-xl">{completed} / 16</strong>
          <div
            role="progressbar"
            aria-label="Post-sales completion"
            aria-valuemin={0}
            aria-valuemax={16}
            aria-valuenow={completed}
            className="mt-3 h-2 overflow-hidden rounded bg-accent"
          >
            <div className="h-full bg-primary" style={{ width: `${(completed / 16) * 100}%` }} />
          </div>
        </div>
      </div>
      {current && (!current.assignedTo || overdue || current.status === "awaiting_approval") && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-primary/20 bg-accent p-4 text-sm"
        >
          <AlertCircle size={18} className="shrink-0" />
          <p>
            {!current.assignedTo ? "Assign an owner to the current stage. " : ""}
            {overdue ? "The current stage is past its planned completion date. " : ""}
            {current.status === "awaiting_approval"
              ? `Review needed from ${current.approverRole}.`
              : ""}
          </p>
        </div>
      )}
      {!detail.stages.length ? (
        <section className="space-y-4 rounded-xl border bg-white p-6">
          <h2 className="text-lg font-semibold">Initialize shared post-sales workflow</h2>
          <p className="text-sm text-muted-foreground">
            This existing order has no stage records. Initialization verifies Won conversion and
            creates sixteen pending stages without inventing past completions.
          </p>
          {detail.canManage && (
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await requestJson(`/api/orders/${detail.order.id}`, "POST");
                  await reload();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Initialize workflow
            </Button>
          )}
        </section>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[270px_minmax(0,1fr)]">
          <section className="min-w-0 rounded-xl border bg-white p-4">
            <h2 className="mb-4 px-2 font-semibold">Shared post-sales workflow</h2>
            <ol className="max-h-72 space-y-2 overflow-y-auto xl:max-h-none xl:overflow-visible">
              {detail.stages.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={busy}
                    aria-current={selected === s.number ? "step" : undefined}
                    onClick={() => changeStage(s.number)}
                    className={`flex w-full items-start gap-2 rounded-lg border p-3 text-left text-xs ${selected === s.number ? "border-primary bg-accent" : "border-transparent hover:bg-background"}`}
                  >
                    {s.status === "completed" ? (
                      <CheckCircle2 size={15} className="shrink-0 text-primary" />
                    ) : (
                      <Clock size={15} className="shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0">
                      <span className="block font-medium">{`${s.number}. ${s.name}${s.number === detail.order.stage && !detail.order.completedAt ? " · current" : ""}`}</span>
                      <span className="mt-1 block text-[10px] text-muted-foreground">
                        {s.status.replaceAll("_", " ")} · {s.assignedName ?? "Unassigned"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
          <div className="min-w-0 space-y-6">
            {stage && (
              <>
                <StageEditor
                  key={`${stage.id}-${stage.version}`}
                  detail={detail}
                  stage={stage}
                  busy={busy}
                  run={run}
                />
                <StageDocuments
                  key={`files-${stage.id}`}
                  detail={detail}
                  stage={stage}
                  busy={busy}
                  onError={setError}
                  onPage={(page) => {
                    setBusy(true);
                    reload({ filePage: page })
                      .catch((e) => setError(e.message))
                      .finally(() => setBusy(false));
                  }}
                  onUpload={async (file, requirementId) => {
                    setBusy(true);
                    setError("");
                    try {
                      const form = new FormData();
                      form.set("file", file);
                      const response = await fetch(
                        `/api/orders/${detail.order.id}/stages/${stage.number}/documents${requirementId ? `?requirementId=${requirementId}` : ""}`,
                        { method: "POST", body: form },
                      );
                      if (!response.ok) {
                        const result = await response.json();
                        throw new Error(result.error ?? "Upload failed");
                      }
                      await reload();
                    } catch (e) {
                      setError((e as Error).message);
                      throw e;
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </>
            )}
            <section className="space-y-3 rounded-xl border bg-white p-5">
              <h2 className="font-semibold">Production loads</h2>
              <div className="flex flex-wrap gap-4 text-sm underline">
                <Link href={`/installations?orderId=${detail.order.id}`}>
                  Installation, audit & handover
                </Link>
                <Link href={`/service?orderId=${detail.order.id}`}>Feedback & service tickets</Link>
              </div>
              <p className="text-xs text-muted-foreground">
                Allocate confirmed items and track each load independently. Empty planning drafts do
                not count as fulfilled quantities.
              </p>
              <Link
                className="inline-block text-sm font-medium underline"
                href={`/production?orderId=${detail.order.id}`}
              >
                Manage allocations and production loads
              </Link>
              {detail.loads.map((load) => (
                <Link
                  href={`/production/${load.id}`}
                  key={load.id}
                  className="block rounded-lg border p-3 text-sm hover:bg-muted"
                >
                  Load {load.loadNumber} · {load.status}
                </Link>
              ))}
              {!detail.loads.length && (
                <p className="text-sm text-muted-foreground">No production loads planned yet.</p>
              )}
            </section>
            <WorkflowTimeline
              detail={detail}
              busy={busy}
              onPage={(page) => {
                setBusy(true);
                reload({ historyPage: page })
                  .catch((e) => setError(e.message))
                  .finally(() => setBusy(false));
              }}
            />
          </div>
        </div>
      )}
      <details className="rounded-xl border bg-white p-5">
        <summary className="cursor-pointer text-sm font-semibold">Approved order items</summary>
        <div className="mt-4 space-y-3">
          {detail.items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap justify-between gap-2 border-b py-3 text-sm"
            >
              <div className="min-w-0">
                <strong>{item.name ?? item.description}</strong>
                <p className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                  {item.description}
                </p>
              </div>
              <span>
                {item.quantity} × {money(item.unitPrice)} · {money(item.amount)}
              </span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
