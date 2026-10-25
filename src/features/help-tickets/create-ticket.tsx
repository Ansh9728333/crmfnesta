"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { requestJson } from "@/features/leads/utils";
import { priorities } from "@/lib/help-tickets/validation";
import type { HelpSource } from "@/lib/help-tickets/service";
import type { Directory, Context } from "./types";
import { Field, selectClass, textareaClass, uploadHelpFile } from "./shared";
export function CreateTicket({ directory: d }: { directory: Directory }) {
  const trigger = useRef<HTMLButtonElement | null>(null);
  const router = useRouter(),
    [open, setOpen] = useState(Boolean(d.selected)),
    [ctx, setCtx] = useState<Context | null>(
      d.selected ? { source: d.selected, resolvers: d.resolvers, policies: d.policies } : null,
    ),
    [results, setResults] = useState<HelpSource[]>([]),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [concern, setConcern] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [requestId, setRequestId] = useState("");
  const selectedPolicy = ctx?.policies.find((x) => x.code === concern);
  async function find(next = 1) {
    setBusy(true);
    setError("");
    try {
      setResults(
        await requestJson(`/api/help-tickets/context?q=${encodeURIComponent(search)}&page=${next}`),
      );
      setPage(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function choose(s: HelpSource) {
    setBusy(true);
    setError("");
    try {
      setCtx(await requestJson(`/api/help-tickets/context?kind=${s.kind}&id=${s.id}`));
      setConcern("");
      setFile(null);
      setRequestId("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        ref={trigger}
        disabled={!d.canRaise}
        onClick={() => {
          setOpen(true);
          setError("");
        }}
      >
        Raise Help Ticket
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
      >
        <DialogContent
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            trigger.current?.focus();
          }}
          className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"
        >
          <DialogTitle>Raise Help Ticket</DialogTitle>
          <DialogDescription>
            Link an existing client, describe the concern and choose who should resolve it.
          </DialogDescription>
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your Name / Raised By">
              <Input value={d.currentUser.name} readOnly />
            </Field>
            <Field label="Your Location">
              <Input value={ctx?.source.location ?? "Select a lead or project"} readOnly />
            </Field>
          </div>
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <h3 className="text-sm font-semibold">Client and project</h3>
            {ctx && (
              <p className="text-sm">
                <strong>{ctx.source.client}</strong> · {ctx.source.name}
                <span className="mt-1 block text-xs text-muted-foreground">
                  {ctx.source.company} · {ctx.source.location}
                </span>
              </p>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void find();
              }}
            >
              <Input
                aria-label="Search client or project"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search existing clients / projects"
                maxLength={100}
              />
              <Button variant="outline" disabled={busy}>
                Search
              </Button>
            </form>
            {results.map((s) => (
              <button
                key={s.kind + s.id}
                disabled={busy}
                type="button"
                className="block w-full rounded-md border bg-background p-3 text-left text-xs hover:bg-muted"
                onClick={() => void choose(s)}
              >
                {s.client} · {s.name}
                <span className="mt-1 block text-muted-foreground">
                  {s.company} · {s.location} · {s.kind}
                </span>
              </button>
            ))}
            {(results.length > 0 || page > 1) && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || page === 1}
                  onClick={() => void find(page - 1)}
                >
                  Previous results
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || results.length < 20}
                  onClick={() => void find(page + 1)}
                >
                  More results
                </Button>
              </div>
            )}
          </div>
          {ctx && (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                setBusy(true);
                const data = new FormData(e.currentTarget);
                try {
                  const id = requestId || crypto.randomUUID();
                  setRequestId(id);
                  const fileId = file
                    ? await uploadHelpFile(file, {
                        source: { kind: ctx.source.kind, id: ctx.source.id },
                      })
                    : undefined;
                  const ticket = await requestJson<{ id: string }>("/api/help-tickets", "POST", {
                    kind: ctx.source.kind,
                    id: ctx.source.id,
                    requestId: id,
                    concern,
                    details: String(data.get("details")),
                    assignedTo: String(data.get("assignedTo")),
                    priority: String(data.get("priority")),
                    ...(fileId ? { fileId } : {}),
                  });
                  window.dispatchEvent(new Event("siteflow-notifications-updated"));
                  setOpen(false);
                  router.push(`/help-tickets/${ticket.id}`);
                  router.refresh();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Concern Type *">
                  <select
                    required
                    className={selectClass}
                    value={concern}
                    onChange={(e) => setConcern(e.target.value)}
                  >
                    <option value="">Select concern</option>
                    {ctx.policies
                      .filter((p) => p.active)
                      .map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Priority *">
                  <select name="priority" className={selectClass} defaultValue="normal">
                    {priorities.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Please Write the Details In Brief *">
                <textarea
                  name="details"
                  required
                  minLength={5}
                  maxLength={5000}
                  className={textareaClass}
                />
              </Field>
              <Field label="Select The Name To whom you want to raise the ticket *">
                <select name="assignedTo" required className={selectClass} defaultValue="">
                  <option value="">Select resolver</option>
                  {ctx.resolvers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              {!ctx.resolvers.length && (
                <p role="status" className="text-xs text-muted-foreground">
                  No active resolver is available at this location. Ask Admin to assign a service
                  role or configure Help permissions.
                </p>
              )}
              <Field
                label={`Supporting Attachment ${selectedPolicy?.attachmentRequired ? "*" : "(optional)"}`}
              >
                <input
                  key={ctx.source.id}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  required={selectedPolicy?.attachmentRequired}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="text-xs"
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                One PDF, JPEG or PNG · maximum 10 MB.{" "}
                {selectedPolicy?.slaHours
                  ? `Target resolution: ${selectedPolicy.slaHours} hours after submission.`
                  : "No SLA configured for this concern."}
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button disabled={busy || !ctx.resolvers.length}>
                  {busy ? "Submitting…" : "Generate Help Ticket"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
