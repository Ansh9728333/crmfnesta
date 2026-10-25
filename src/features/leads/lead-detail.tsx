"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  History,
  MapPin,
  MessageSquare,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { preSalesStages } from "@/lib/domain/workflows";
import type { Directory, LeadDetail } from "./types";
import { dateTime, leadInput, money, requestJson, selectClass, utcInput } from "./utils";
import { LeadForm } from "./lead-form";

export function LeadDetailView({
  initial,
  directory,
  onChanged,
  fullPage = false,
}: {
  initial: LeadDetail;
  directory: Directory;
  onChanged?: () => void;
  fullPage?: boolean;
}) {
  const [detail, setDetail] = useState(initial),
    [editing, setEditing] = useState(false),
    [stageOpen, setStageOpen] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [activityPage, setActivityPage] = useState(1),
    [archiveOpen, setArchiveOpen] = useState(false);
  const lead = detail.lead;
  const [stage, setStage] = useState(Math.min(lead.stage + 1, 7)),
    [outcome, setOutcome] = useState<"open" | "won" | "lost">(lead.stage >= 6 ? "won" : "open"),
    [lostReason, setLostReason] = useState(""),
    [finalValue] = useState(lead.finalisedValue ?? "");
  async function reload(page = activityPage, followUpPage = detail.followUpPage) {
    setDetail(
      await requestJson<LeadDetail>(
        `/api/leads/${lead.id}?activityPage=${page}&followUpPage=${followUpPage}`,
      ),
    );
    setActivityPage(page);
    onChanged?.();
  }
  async function run(path: string, method: string, body: unknown, after?: () => void) {
    setBusy(true);
    setError("");
    try {
      await requestJson(path, method, body);
      await reload();
      after?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }
  const metrics = [
    ["Expected value", money(lead.expectedValue)],
    ["Finalised value", money(lead.finalisedValue)],
    ["Assigned executive", lead.assignedName ?? "Unassigned"],
    ["Priority", lead.priority],
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge variant="secondary">{lead.companyName}</Badge>
            <Badge variant="outline">{lead.outcome ?? "Open"}</Badge>
            {lead.archivedAt && <Badge variant="outline">Archived</Badge>}
          </div>
          <h1 className={`${fullPage ? "text-3xl" : "text-2xl"} font-semibold tracking-tight`}>
            {lead.clientName}
          </h1>
          <a className="mt-2 inline-flex text-sm text-primary" href={`tel:${lead.mobile}`}>
            {lead.mobile}
          </a>
          <p className="mt-2 text-xs text-muted-foreground">
            {lead.projectName ?? "Project not linked"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/help-tickets?kind=lead&sourceId=${lead.id}`}>Raise Help Ticket</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/leads/${lead.id}/presales`}>Pre-sales workspace</Link>
          </Button>
          {!fullPage && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/leads/${lead.id}`}>
                Full page <ExternalLink size={13} />
              </Link>
            </Button>
          )}
          {detail.canEdit && (
            <Button
              size="sm"
              onClick={() => {
                setError("");
                setEditing(true);
              }}
            >
              Edit lead
            </Button>
          )}
          {detail.canEdit && !lead.outcome && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setStage(Math.min(lead.stage + 1, 7));
                setOutcome(lead.stage >= 6 ? "won" : "open");
                setStageOpen(true);
              }}
            >
              Update stage <ArrowRight size={14} />
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-white p-4 text-xs text-destructive"
        >
          {error}
        </p>
      )}
      <div className="rounded-xl border bg-primary p-5 text-white">
        <p className="text-[10px] uppercase tracking-[0.16em] text-white/60">
          PRE-SALES WORKFLOW · {lead.stage} OF 7
        </p>
        <h2 className="mt-2 text-base font-semibold">{preSalesStages[lead.stage - 1]}</h2>
        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {preSalesStages.map((s, i) => (
            <span
              key={s}
              title={s}
              className={`h-1.5 rounded-full ${i < lead.stage ? "bg-[#dce9bf]" : "bg-white/15"}`}
            />
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value]) => (
          <div className="rounded-xl border bg-white p-4" key={label}>
            <p className="text-[10px] text-muted-foreground">{label}</p>
            <p className="mt-2 text-sm font-semibold capitalize">{value}</p>
          </div>
        ))}
      </div>
      {detail.orderId && (
        <p className="flex items-center gap-2 rounded-xl border bg-accent p-4 text-xs text-primary">
          <CheckCircle2 size={17} /> Won · linked order {detail.orderId.slice(0, 8).toUpperCase()}{" "}
          was created in the post-sales workflow.
        </p>
      )}
      {lead.lossReason && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-xs font-semibold">Lost reason</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm">{lead.lossReason}</p>
        </section>
      )}
      <section className="rounded-xl border bg-white p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <MapPin size={16} className="text-primary" /> Site & enquiry
        </h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7">
          {lead.siteAddress ?? "Not recorded"}
        </p>
        <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Brand", lead.brand],
            ["Company", lead.companyName],
            ["Territory", lead.territory],
            ["SOE", lead.soe],
            ["Lead source", lead.source],
            ["Customer type", lead.customerType],
            ["Building type", lead.buildingType],
            ["Order type", lead.orderType],
            [
              "Booking month",
              lead.bookingMonth
                ? new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(
                    new Date(Date.UTC(2020, lead.bookingMonth - 1, 1)),
                  )
                : null,
            ],
            ["Financial year", lead.financialYear],
            ["Order qty", lead.orderQty],
            ["Pleated mesh qty", lead.pleatedMeshQty],
            ["uPVC / Aluminium", lead.material],
            ["Discount offered", lead.discountOffered],
            ["CSE", lead.cseName ?? (lead.cseId ? "Assigned CSE" : "Not assigned")],
            ["Created", dateTime(lead.createdAt)],
            ["Updated", dateTime(lead.updatedAt)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-[10px] text-muted-foreground">{label}</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-xs">{value || "—"}</dd>
            </div>
          ))}
        </dl>
        {lead.remarks && (
          <div className="mt-5 border-t pt-4">
            <h3 className="text-[10px] text-muted-foreground">Remarks</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{lead.remarks}</p>
          </div>
        )}
      </section>
      <section className="rounded-xl border bg-white p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarClock size={17} className="text-primary" /> Follow-up tracking
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Next: {dateTime(lead.nextFollowUp)}
          {lead.nextAction ? ` · ${lead.nextAction}` : ""}
        </p>
        <div className="mt-5 space-y-3">
          {detail.followUps.map((f) => (
            <article key={f.id} className="rounded-lg border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xs font-semibold">{f.action}</h3>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {dateTime(f.dueAt)} · {f.state}
                  </p>
                </div>
                <Badge variant="outline" className="text-[9px]">
                  {f.state}
                </Badge>
              </div>
              {f.completionNotes && (
                <p className="mt-3 whitespace-pre-wrap text-xs leading-6">{f.completionNotes}</p>
              )}
              {f.state === "pending" && detail.canEdit && (
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget,
                      notes = new FormData(form).get("notes");
                    void run(
                      `/api/leads/${lead.id}/follow-ups/${f.id}`,
                      "PATCH",
                      { version: lead.version, notes },
                      () => form.reset(),
                    );
                  }}
                >
                  <Input
                    name="notes"
                    aria-label={`Completion notes for ${f.action}`}
                    placeholder="Outcome / completion notes"
                    required
                    minLength={2}
                    maxLength={4000}
                  />
                  <Button variant="outline" size="sm" disabled={busy}>
                    Complete
                  </Button>
                </form>
              )}
            </article>
          ))}
          {!detail.followUps.length && (
            <p className="rounded-lg bg-background p-5 text-center text-xs text-muted-foreground">
              No follow-ups recorded. Plan a next step to keep this opportunity moving.
            </p>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {detail.followUpTotal} follow-ups · Page {detail.followUpPage} of{" "}
            {Math.max(1, Math.ceil(detail.followUpTotal / 20))}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={busy || detail.followUpPage <= 1}
              onClick={() => {
                setBusy(true);
                reload(activityPage, detail.followUpPage - 1)
                  .catch((e) => setError(e.message))
                  .finally(() => setBusy(false));
              }}
            >
              Previous follow-ups
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy || detail.followUpPage * 20 >= detail.followUpTotal}
              onClick={() => {
                setBusy(true);
                reload(activityPage, detail.followUpPage + 1)
                  .catch((e) => setError(e.message))
                  .finally(() => setBusy(false));
              }}
            >
              More follow-ups
            </Button>
          </div>
        </div>
        {detail.canEdit && !lead.outcome && (
          <form
            className="mt-5 grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget,
                data = new FormData(form);
              void run(
                `/api/leads/${lead.id}/follow-ups`,
                "POST",
                {
                  version: lead.version,
                  dueAt: utcInput(String(data.get("dueAt"))),
                  action: data.get("action"),
                },
                () => form.reset(),
              );
            }}
          >
            <label className="text-xs">
              Follow-up due (IST)
              <Input className="mt-2" type="datetime-local" name="dueAt" required />
            </label>
            <label className="text-xs">
              Next action
              <Input className="mt-2" name="action" required minLength={2} maxLength={500} />
            </label>
            <Button className="sm:col-span-2" variant="outline" disabled={busy}>
              Add follow-up
            </Button>
          </form>
        )}
      </section>
      <section className="rounded-xl border bg-white p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <History size={17} className="text-primary" /> Activity timeline{" "}
          <span className="text-xs font-normal text-muted-foreground">
            ({detail.activityTotal})
          </span>
        </h2>
        {detail.canEdit && (
          <form
            className="my-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              void run(
                `/api/leads/${lead.id}/activities`,
                "POST",
                { version: lead.version, notes: new FormData(form).get("notes") },
                () => form.reset(),
              );
            }}
          >
            <textarea
              name="notes"
              aria-label="Activity note"
              className="min-h-20 w-full rounded-md border p-3 text-sm"
              placeholder="Record a conversation, site visit or quotation revision…"
              required
              minLength={2}
              maxLength={4000}
            />
            <Button variant="outline" size="sm" disabled={busy}>
              <MessageSquare size={14} /> Add note
            </Button>
          </form>
        )}
        <ol className="mt-5 space-y-6">
          {detail.activities.map((a) => (
            <li key={a.id} className="relative border-l-2 border-accent pl-5">
              <span className="absolute -left-[5px] top-1 size-2 rounded-full bg-primary" />
              <p className="whitespace-pre-wrap text-xs font-medium leading-6">{a.summary}</p>
              <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                <UserRound size={11} />
                {a.actorName} · {dateTime(a.createdAt)}
              </p>
              {Object.keys(a.changes).length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[10px] text-primary">
                    View {Object.keys(a.changes).length} recorded changes
                  </summary>
                  <dl className="mt-3 space-y-2 rounded-lg bg-background p-3">
                    {Object.entries(a.changes).map(([key, v]) => (
                      <div className="break-words text-[10px] leading-5" key={key}>
                        <dt className="font-semibold">{key}</dt>
                        <dd>
                          {[v.before, v.after].map((value, index) => (
                            <div key={index}>
                              <span className="font-medium text-muted-foreground">
                                {index === 0 ? "Before: " : "After: "}
                              </span>
                              {value !== null && typeof value === "object" ? (
                                <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded border bg-white p-2">
                                  {JSON.stringify(value, null, 2)}
                                </pre>
                              ) : (
                                String(value ?? "—")
                              )}
                            </div>
                          ))}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
            </li>
          ))}
        </ol>
        <div className="mt-6 flex items-center justify-between">
          <Button
            size="sm"
            variant="ghost"
            disabled={busy || activityPage === 1}
            onClick={() => {
              setBusy(true);
              reload(activityPage - 1)
                .catch((e) => setError(e.message))
                .finally(() => setBusy(false));
            }}
          >
            Newer activity
          </Button>
          <span className="text-[10px] text-muted-foreground">
            Page {activityPage} / {Math.max(1, Math.ceil(detail.activityTotal / 25))}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy || activityPage * 25 >= detail.activityTotal}
            onClick={() => {
              setBusy(true);
              reload(activityPage + 1)
                .catch((e) => setError(e.message))
                .finally(() => setBusy(false));
            }}
          >
            Older activity
          </Button>
        </div>
      </section>
      {detail.canArchive && lead.outcome !== "won" && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setArchiveOpen(true)}>
            {lead.archivedAt ? "Restore lead" : "Archive lead"}
          </Button>
        </div>
      )}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
          <DialogTitle>Edit lead</DialogTitle>
          <DialogDescription>
            Changes are validated and recorded in the activity timeline.
          </DialogDescription>
          {editing && (
            <LeadForm
              directory={directory}
              lead={lead}
              onSaved={async () => {
                await reload();
                setEditing(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={stageOpen} onOpenChange={setStageOpen}>
        <DialogContent>
          <DialogTitle>Update pre-sales stage</DialogTitle>
          <DialogDescription>
            Advance one stage at a time. Lost can be recorded at any point with a reason.
          </DialogDescription>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const data = {
                ...leadInput(lead),
                stage,
                outcome: stage === 7 ? outcome : "open",
                lossReason: lostReason,
                finalisedValue: finalValue,
              };
              void run(`/api/leads/${lead.id}`, "PATCH", { version: lead.version, data }, () =>
                setStageOpen(false),
              );
            }}
          >
            <label className="block text-xs">
              Stage
              <select
                className={`${selectClass} mt-2`}
                value={stage}
                onChange={(e) => {
                  setStage(Number(e.target.value));
                  setOutcome(
                    Number(e.target.value) === 7 ? (lead.stage < 6 ? "lost" : "won") : "open",
                  );
                }}
              >
                {preSalesStages.map((s, i) => (
                  <option
                    key={s}
                    value={i + 1}
                    disabled={i + 1 < lead.stage || (i + 1 > lead.stage + 1 && i + 1 !== 7)}
                  >
                    {i + 1}. {s}
                  </option>
                ))}
              </select>
            </label>
            {stage === 7 && (
              <>
                <label className="block text-xs">
                  Outcome
                  <select
                    className={`${selectClass} mt-2`}
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value as "won" | "lost")}
                  >
                    <option value="won" disabled={lead.stage < 6}>
                      Won
                    </option>
                    <option value="lost">Lost</option>
                  </select>
                </label>
                {outcome === "lost" ? (
                  <label className="block text-xs">
                    Lost reason
                    <Input
                      className="mt-2"
                      value={lostReason}
                      onChange={(e) => setLostReason(e.target.value)}
                      required
                      minLength={3}
                      maxLength={1000}
                    />
                  </label>
                ) : (
                  <Button asChild variant="outline">
                    <Link href={`/leads/${lead.id}/presales?tab=conversion`}>
                      Confirm quotation & convert to order
                    </Link>
                  </Button>
                )}
              </>
            )}
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <Button className="w-full" disabled={busy || (stage === 7 && outcome === "won")}>
              Confirm stage change
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent>
          <DialogTitle>{lead.archivedAt ? "Restore lead?" : "Archive lead?"}</DialogTitle>
          <DialogDescription>
            History is retained. Archived leads are excluded from the active pipeline.
          </DialogDescription>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                `/api/leads/${lead.id}`,
                "DELETE",
                {
                  version: lead.version,
                  reason: new FormData(e.currentTarget).get("reason"),
                  restore: !!lead.archivedAt,
                },
                () => setArchiveOpen(false),
              );
            }}
          >
            <Input
              aria-label="Archive or restore reason"
              name="reason"
              placeholder="Reason"
              required
              minLength={3}
              maxLength={500}
            />
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <Button disabled={busy}>Confirm</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
