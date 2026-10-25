"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { requestJson, dateTime } from "@/features/leads/utils";
import { labels } from "@/lib/help-tickets/validation";
import type { TicketDetail } from "./types";
import { Field, selectClass, textareaClass, uploadHelpFile } from "./shared";
export function TicketDetailView({
  initial,
  onChanged,
}: {
  initial: TicketDetail;
  onChanged?: () => void;
}) {
  const router = useRouter(),
    [d, setD] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notes, setNotes] = useState(""),
    [assigned, setAssigned] = useState(""),
    [file, setFile] = useState<File | null>(null);
  const t = d.ticket,
    active = ["raised", "in_progress", "reopened"].includes(t.status);
  async function action(action: string) {
    setError("");
    if (notes.trim().length < 3) {
      setError("Enter a solution, confirmation or reason (at least 3 characters).");
      return;
    }
    setBusy(true);
    try {
      const fileId =
        action === "resolve" && file ? await uploadHelpFile(file, { ticketId: t.id }) : undefined;
      await requestJson(`/api/help-tickets/${t.id}`, "PATCH", {
        action,
        version: t.version,
        notes,
        ...(action === "reassign" ? { assignedTo: assigned } : {}),
        ...(fileId ? { fileId } : {}),
      });
      setD(await requestJson(`/api/help-tickets/${t.id}`));
      setNotes("");
      setFile(null);
      window.dispatchEvent(new Event("siteflow-notifications-updated"));
      onChanged?.();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{t.number}</h1>
          <Badge variant="outline">{labels[t.status]}</Badge>
          <Badge variant="secondary">{t.priority}</Badge>
        </div>
        <p className="text-sm">
          <strong>{d.info.client}</strong> · {d.info.project ?? "Lead enquiry"}
        </p>
        <p className="text-xs text-muted-foreground">
          {d.info.company} · {d.info.location}
        </p>
      </header>
      <div className="grid gap-3 rounded-xl border bg-card p-5 text-sm sm:grid-cols-2">
        <p>
          Raised by <strong>{d.info.creator}</strong>
        </p>
        <p>
          Resolver: <strong>{d.info.resolver}</strong>
        </p>
        <p>Raised: {dateTime(t.createdAt)}</p>
        <p>Due: {t.dueAt ? dateTime(t.dueAt) : "No SLA configured"}</p>
        {t.resolvedAt && <p>Resolved: {dateTime(t.resolvedAt)}</p>}
        {t.closedAt && <p>Closed: {dateTime(t.closedAt)}</p>}
      </div>
      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">{t.concern}</h2>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm">{t.details}</p>
        <div className="mt-4 flex gap-4 text-xs font-semibold text-primary">
          {d.canViewLead && <Link href={`/leads/${t.leadId}`}>Open lead</Link>}
          {d.canViewProject && (
            <Link
              href={`/projects?customerId=${t.customerId}&q=${encodeURIComponent(d.info.project ?? "")}`}
            >
              Open project
            </Link>
          )}
          <Link href={`/help-tickets/${t.id}`}>Full ticket page</Link>
        </div>
      </section>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {((d.canResolve && active) ||
        (d.canConfirm && t.status === "awaiting_confirmation") ||
        (d.canReopen && ["awaiting_confirmation", "closed"].includes(t.status)) ||
        (d.admin && t.status !== "closed")) && (
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Next action</h2>
          <Field label="Resolution, confirmation or reason *">
            <textarea
              className={textareaClass}
              value={notes}
              maxLength={5000}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
          {d.canResolve && active && (
            <Field label="Resolution proof (optional, PDF/JPEG/PNG up to 10 MB)">
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </Field>
          )}
          <div className="flex flex-wrap gap-2">
            {d.canResolve && ["raised", "reopened"].includes(t.status) && (
              <Button disabled={busy} variant="outline" onClick={() => void action("start")}>
                Start work
              </Button>
            )}
            {d.canResolve && active && (
              <Button disabled={busy} onClick={() => void action("resolve")}>
                {busy ? "Saving…" : "Submit resolution"}
              </Button>
            )}
            {d.canConfirm && t.status === "awaiting_confirmation" && (
              <Button disabled={busy} onClick={() => void action("close")}>
                Confirm &amp; Close
              </Button>
            )}
            {d.canReopen && ["awaiting_confirmation", "closed"].includes(t.status) && (
              <Button disabled={busy} variant="outline" onClick={() => void action("reopen")}>
                Reopen with reason
              </Button>
            )}
          </div>
          {d.admin && t.status !== "closed" && (
            <div className="flex flex-wrap items-end gap-3 border-t pt-4">
              <div className="min-w-48 flex-1">
                <Field label="Reassign resolver (Admin)">
                  <select
                    className={selectClass}
                    value={assigned}
                    onChange={(e) => setAssigned(e.target.value)}
                  >
                    <option value="">Select different resolver</option>
                    {d.resolvers
                      .filter((x) => x.id !== t.assignedTo)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                  </select>
                </Field>
              </div>
              <Button
                disabled={busy || !assigned}
                variant="outline"
                onClick={() => void action("reassign")}
              >
                Reassign
              </Button>
            </div>
          )}
        </section>
      )}
      {t.status === "awaiting_confirmation" && (
        <p className="rounded-lg bg-secondary p-4 text-xs">
          Solution submitted. The creator or an independent Admin must confirm it. Self-assigned
          tickets require a separate Admin.
        </p>
      )}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Attachments</h2>
        {!d.files.length && (
          <p className="mt-3 text-xs text-muted-foreground">No attachments uploaded.</p>
        )}
        {d.files.map((f) => (
          <div
            key={f.id}
            className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm"
          >
            <span className="break-all">{f.name}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const r = await requestJson<{ url: string }>(
                    `/api/help-tickets/files?id=${f.id}`,
                  );
                  window.location.assign(r.url);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Download
            </Button>
          </div>
        ))}
      </section>
      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Activity history</h2>
        <ol className="mt-4 space-y-5 border-l-2 border-primary/20 pl-4">
          {d.events.map((e) => (
            <li key={e.id}>
              <p className="text-xs font-semibold">
                {e.action.replaceAll("_", " ")} · {e.actor}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{dateTime(e.createdAt)}</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm">{e.notes}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
