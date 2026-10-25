"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownUp,
  ArrowRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Columns3,
  List,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { preSalesStages } from "@/lib/domain/workflows";
import type { LeadFilters } from "@/lib/leads/validation";
import type { Directory, LeadBoard, LeadDetail, LeadList, LeadRow, Summary } from "./types";
import { LeadForm } from "./lead-form";
import { LeadDetailView } from "./lead-detail";
import { dateTime, leadInput, money, requestJson, selectClass } from "./utils";

export function LeadWorkspace({
  directory,
  list,
  board,
  summary,
  filters,
  view,
}: {
  directory: Directory;
  list: LeadList;
  board: LeadBoard;
  summary: Summary;
  filters: LeadFilters;
  view: "board" | "table";
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [detail, setDetail] = useState<LeadDetail | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [columns, setColumns] = useState(board),
    [columnBusy, setColumnBusy] = useState<number | null>(null),
    [moving, setMoving] = useState<{ lead: LeadRow; stage: number } | null>(null),
    [outcome, setOutcome] = useState("lost"),
    [reason, setReason] = useState(""),
    [finalValue, setFinalValue] = useState("");
  const query = (patch: Record<string, string | number>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filters, view, ...patch }))
      if (value !== "" && value !== undefined) params.set(key, String(value));
    return params;
  };
  const navigate = (patch: Record<string, string | number>) =>
    router.push(`/leads?${query(patch)}`);
  useEffect(() => {
    if (!selected) return;
    let live = true;
    requestJson<LeadDetail>(`/api/leads/${selected}`)
      .then((d) => {
        if (live) setDetail(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [selected]);
  const open = (id: string) => {
    setDetail(null);
    setError("");
    setSelected(id);
  };
  const close = () => {
    setSelected(null);
    setDetail(null);
    router.refresh();
  };
  const beginMove = (lead: LeadRow, stage = Math.min(lead.stage + 1, 7)) => {
    setError("");
    setMoving({ lead, stage });
    setOutcome(stage === 7 && lead.stage >= 6 ? "won" : "lost");
    setReason("");
    setFinalValue(lead.finalisedValue ?? "");
  };
  async function more(stage: number) {
    const column = columns.find((c) => c.stage === stage);
    if (!column) return;
    setColumnBusy(stage);
    try {
      const result = await requestJson<LeadList>(
        `/api/leads?${query({ stage, page: column.page + 1, pageSize: 10 })}`,
      );
      setColumns((prev) =>
        prev.map((c) =>
          c.stage === stage
            ? { ...c, rows: [...c.rows, ...result.rows], page: column.page + 1 }
            : c,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load leads");
    } finally {
      setColumnBusy(null);
    }
  }
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
            COMMON PRE-SALES WORKFLOW
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Every opportunity, in motion.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            From the first enquiry to a confident decision. One pipeline for all three companies.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/customers">Customers</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/projects">Projects</Link>
          </Button>
          {directory.canCreate && (
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} /> Add lead
            </Button>
          )}
        </div>
      </header>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Open opportunities", summary.open],
          ["Pipeline value", money(summary.pipelineValue)],
          ["Won", summary.won],
          ["Lost", summary.lost],
          ["Overdue follow-ups", summary.overdue],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-white p-5">
            <p className="text-[10px] text-muted-foreground">{label}</p>
            <p className="mt-3 break-words text-xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <section className="rounded-xl border bg-white p-4">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget),
              params: Record<string, string | number> = { page: 1, view };
            for (const [key, value] of form.entries()) params[key] = String(value);
            navigate(params);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr]">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-muted-foreground" size={15} />
              <Input
                aria-label="Search leads"
                name="q"
                defaultValue={filters.q}
                className="pl-9"
                placeholder="Client, mobile, project or address"
                maxLength={100}
              />
            </div>
            <select
              aria-label="Company filter"
              name="organizationId"
              className={selectClass}
              defaultValue={filters.organizationId}
            >
              <option value="">All companies</option>
              {directory.organizations.map((o) => (
                <option value={o.id} key={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Assigned employee filter"
              name="assignedTo"
              className={selectClass}
              defaultValue={filters.assignedTo}
            >
              <option value="">All assigned employees</option>
              {[...new Map(directory.employees.map((p) => [p.id, p])).values()].map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Stage filter"
              name="stage"
              className={selectClass}
              defaultValue={filters.stage ?? ""}
            >
              <option value="">All stages</option>
              {preSalesStages.map((s, i) => (
                <option value={i + 1} key={s}>
                  {i + 1}. {s}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <select
              aria-label="Status filter"
              name="outcome"
              defaultValue={filters.outcome}
              className={selectClass}
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
            <select
              aria-label="Priority filter"
              name="priority"
              defaultValue={filters.priority}
              className={selectClass}
            >
              <option value="">All priorities</option>
              {["low", "normal", "high", "urgent"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select
              aria-label="Follow-up filter"
              name="followUp"
              defaultValue={filters.followUp}
              className={selectClass}
            >
              <option value="">All follow-ups</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due today (IST)</option>
              <option value="upcoming">Upcoming</option>
              <option value="none">Not scheduled</option>
            </select>
            <select
              aria-label="Branch filter"
              name="centreId"
              defaultValue={filters.centreId}
              className={selectClass}
            >
              <option value="">All branches</option>
              {directory.centres.map((c) => (
                <option value={c.id} key={c.id}>
                  {directory.organizations.find((o) => o.id === c.organizationId)?.name} · {c.name}
                </option>
              ))}
            </select>
            <Input
              name="source"
              aria-label="Source filter"
              placeholder="Lead source"
              defaultValue={filters.source}
            />
            <Input
              name="territory"
              aria-label="Territory filter"
              placeholder="Territory"
              defaultValue={filters.territory}
            />
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer text-primary">Booking & archive filters</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Input
                aria-label="Financial year filter"
                name="financialYear"
                defaultValue={filters.financialYear}
                placeholder="Financial year, e.g. 2026-27"
                maxLength={7}
              />
              <select
                aria-label="Booking month filter"
                className={selectClass}
                name="bookingMonth"
                defaultValue={filters.bookingMonth ?? ""}
              >
                <option value="">All booking months</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option value={i + 1} key={i}>
                    {i + 1}
                  </option>
                ))}
              </select>
              <select
                aria-label="Archive filter"
                name="archived"
                className={selectClass}
                defaultValue={filters.archived}
              >
                <option value="">Active records</option>
                <option value="yes">Archived records</option>
              </select>
            </div>
          </details>
          <div className="flex items-center justify-between gap-3 border-t pt-3">
            <div className="flex gap-2">
              <Button size="sm" type="submit">
                Apply filters
              </Button>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() => router.push(`/leads?view=${view}`)}
              >
                Clear
              </Button>
            </div>
            <div className="flex rounded-lg border p-1">
              <Button
                type="button"
                size="sm"
                variant={view === "board" ? "secondary" : "ghost"}
                aria-pressed={view === "board"}
                onClick={() => navigate({ view: "board", page: 1 })}
              >
                <Columns3 size={15} />
                <span className="hidden sm:inline">Pipeline</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant={view === "table" ? "secondary" : "ghost"}
                aria-pressed={view === "table"}
                onClick={() => navigate({ view: "table", page: 1 })}
              >
                <List size={15} />
                <span className="hidden sm:inline">Table</span>
              </Button>
            </div>
          </div>
        </form>
      </section>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-white p-4 text-xs text-destructive"
        >
          {error}
        </p>
      )}
      <p role="status" className="text-xs text-muted-foreground">
        {summary.total} matching {summary.total === 1 ? "lead" : "leads"} · Results and permissions
        are checked on the server.
      </p>
      {view === "board" ? (
        <div className="max-w-full overflow-x-auto pb-4" aria-label="Kanban sales pipeline">
          <div className="grid min-w-[2020px] grid-cols-7 items-start gap-4">
            {columns.map((column) => (
              <section
                key={column.stage}
                className="rounded-xl border bg-[#eff2eb] p-3"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  try {
                    const value = JSON.parse(
                      e.dataTransfer.getData("application/siteflow-lead"),
                    ) as LeadRow;
                    if (value?.id) beginMove(value, column.stage);
                  } catch {
                    setError("Use the Move button to update this lead");
                  }
                }}
              >
                <header className="mb-4 flex min-h-14 items-start justify-between gap-2 px-1">
                  <div>
                    <span className="text-[9px] font-semibold tracking-widest text-primary">
                      0{column.stage}
                    </span>
                    <h2 className="mt-1 text-xs font-semibold leading-5">
                      {preSalesStages[column.stage - 1]}
                    </h2>
                  </div>
                  <Badge variant="outline">{column.total}</Badge>
                </header>
                <div className="space-y-3">
                  {column.rows.map((lead) => (
                    <article
                      key={lead.id}
                      className="rounded-lg border bg-white p-4 shadow-sm"
                      draggable={!lead.outcome && !lead.archivedAt && directory.canCreate}
                      onDragStart={(e) =>
                        e.dataTransfer.setData("application/siteflow-lead", JSON.stringify(lead))
                      }
                    >
                      <div className="flex justify-between gap-2">
                        <Badge variant="secondary" className="text-[9px]">
                          {lead.companyName}
                        </Badge>
                        <span className="text-[9px] capitalize text-muted-foreground">
                          {lead.outcome ?? lead.priority}
                        </span>
                      </div>
                      <button
                        className="mt-4 block text-left text-sm font-semibold hover:text-primary"
                        onClick={() => open(lead.id)}
                      >
                        {lead.clientName}
                      </button>
                      <p className="mt-1 truncate text-[10px] text-muted-foreground">
                        {lead.projectName ?? lead.siteAddress}
                      </p>
                      <p className="mt-4 text-base font-semibold text-primary">
                        {money(lead.expectedValue)}
                      </p>
                      <div className="mt-4 space-y-2 border-t pt-3 text-[10px] text-muted-foreground">
                        <p className="flex items-center gap-2">
                          <UserRound size={12} />
                          {lead.assignedName ?? "Unassigned"}
                        </p>
                        <p className="flex items-center gap-2">
                          <CalendarClock size={12} />
                          {dateTime(lead.nextFollowUp)}
                        </p>
                      </div>
                      <div className="mt-3 flex justify-between">
                        <Button size="sm" variant="ghost" onClick={() => open(lead.id)}>
                          Details <ArrowRight size={12} />
                        </Button>
                        {!lead.outcome && !lead.archivedAt && directory.canCreate && (
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label={`Move ${lead.clientName}`}
                            onClick={() => beginMove(lead)}
                          >
                            <ArrowDownUp size={12} /> Move
                          </Button>
                        )}
                      </div>
                    </article>
                  ))}
                  {!column.rows.length && (
                    <p className="rounded-lg border border-dashed p-6 text-center text-[10px] leading-5 text-muted-foreground">
                      No matching leads at this stage.
                    </p>
                  )}
                  {column.rows.length < column.total && (
                    <Button
                      className="w-full"
                      variant="outline"
                      size="sm"
                      disabled={columnBusy === column.stage}
                      onClick={() => void more(column.stage)}
                    >
                      {columnBusy === column.stage ? "Loading…" : "Load more leads"}
                    </Button>
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : (
        <section className="overflow-hidden rounded-xl border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px] text-left text-xs">
              <caption className="sr-only">Pre-sales leads</caption>
              <thead className="bg-background text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  {[
                    "Client / Project",
                    "Company",
                    "Executive",
                    "Stage / Status",
                    "Value",
                    "Next follow-up",
                    "Priority",
                    "",
                  ].map((h) => (
                    <th className="px-5 py-4 font-medium" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.rows.map((lead) => (
                  <tr key={lead.id} className="border-t">
                    <td className="px-5 py-5">
                      <button
                        className="text-left font-semibold hover:text-primary"
                        onClick={() => open(lead.id)}
                      >
                        {lead.clientName}
                      </button>
                      <p className="mt-1 text-[10px] text-muted-foreground">{lead.mobile}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{lead.projectName}</p>
                    </td>
                    <td className="px-5 py-5">{lead.companyName}</td>
                    <td className="px-5 py-5">{lead.assignedName}</td>
                    <td className="px-5 py-5">
                      <p className="max-w-44 leading-5">{preSalesStages[lead.stage - 1]}</p>
                      <Badge variant="secondary" className="mt-2 text-[9px]">
                        {lead.outcome ?? "Open"}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-5 font-medium">
                      {money(lead.expectedValue)}
                    </td>
                    <td className="px-5 py-5">
                      <p>{dateTime(lead.nextFollowUp)}</p>
                      <p className="mt-1 max-w-44 truncate text-[10px] text-muted-foreground">
                        {lead.nextAction}
                      </p>
                    </td>
                    <td className="px-5 py-5 capitalize">{lead.priority}</td>
                    <td className="px-5 py-5">
                      <Button size="sm" variant="outline" onClick={() => open(lead.id)}>
                        View lead
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!list.rows.length && (
              <div className="p-12 text-center">
                <h2 className="font-semibold">No leads match these filters</h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  Adjust the filters or capture a new enquiry.
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
            <label className="flex items-center gap-2 text-xs">
              Rows per page
              <select
                className="rounded border bg-white p-2"
                value={filters.pageSize}
                onChange={(e) => navigate({ pageSize: e.target.value, page: 1 })}
              >
                {[10, 20, 50].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous page"
                disabled={list.page <= 1}
                onClick={() => navigate({ page: list.page - 1 })}
              >
                <ChevronLeft size={15} />
              </Button>
              <span className="text-xs">
                Page {list.page} of {Math.max(1, Math.ceil(list.total / list.pageSize))}
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label="Next page"
                disabled={list.page * list.pageSize >= list.total}
                onClick={() => navigate({ page: list.page + 1 })}
              >
                <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        </section>
      )}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
          <DialogTitle>Add lead</DialogTitle>
          <DialogDescription>
            Capture the enquiry and create or link its customer and project. Finalised order value
            is optional at this stage.
          </DialogDescription>
          {creating && (
            <LeadForm
              directory={directory}
              onSaved={(id) => {
                setCreating(false);
                router.push(`/leads/${id}`);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Sheet
        open={!!selected}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <SheetContent className="w-full overflow-y-auto p-5 sm:max-w-3xl">
          <SheetTitle className="sr-only">Lead details</SheetTitle>
          <SheetDescription className="sr-only">
            Customer details, ownership, activity and follow-up history.
          </SheetDescription>
          {detail ? (
            <LeadDetailView
              key={`${detail.lead.id}-${detail.lead.version}`}
              initial={detail}
              directory={directory}
            />
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {error || "Loading lead details…"}
            </p>
          )}
        </SheetContent>
      </Sheet>
      <Dialog
        open={!!moving}
        onOpenChange={(value) => {
          if (!value && !loading) setMoving(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Move lead</DialogTitle>
          <DialogDescription>
            {moving?.lead.clientName} · Stage changes are recorded in the timeline.
          </DialogDescription>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!moving) return;
              setLoading(true);
              setError("");
              try {
                const current = await requestJson<LeadDetail>(`/api/leads/${moving.lead.id}`);
                await requestJson(`/api/leads/${moving.lead.id}`, "PATCH", {
                  version: moving.lead.version,
                  data: {
                    ...leadInput(current.lead),
                    stage: moving.stage,
                    outcome: moving.stage === 7 ? outcome : "open",
                    lossReason: reason,
                    finalisedValue: finalValue,
                  },
                });
                setMoving(null);
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Stage update failed");
              } finally {
                setLoading(false);
              }
            }}
          >
            <label className="block text-xs">
              Stage
              <select
                className={`${selectClass} mt-2`}
                value={moving?.stage ?? 1}
                onChange={(e) => {
                  setMoving((prev) => (prev ? { ...prev, stage: Number(e.target.value) } : null));
                  setOutcome(
                    Number(e.target.value) === 7 && (moving?.lead.stage ?? 0) >= 6 ? "won" : "lost",
                  );
                }}
              >
                {preSalesStages.map((s, i) => (
                  <option
                    key={s}
                    value={i + 1}
                    disabled={
                      !!moving &&
                      (i + 1 < moving.lead.stage || (i + 1 > moving.lead.stage + 1 && i + 1 !== 7))
                    }
                  >
                    {i + 1}. {s}
                  </option>
                ))}
              </select>
            </label>
            {moving?.stage === 7 && (
              <>
                <label className="block text-xs">
                  Outcome
                  <select
                    className={`${selectClass} mt-2`}
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                  >
                    <option value="won" disabled={moving.lead.stage < 6}>
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
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      required
                      minLength={3}
                      maxLength={1000}
                    />
                  </label>
                ) : (
                  <Button asChild variant="outline">
                    <Link href={`/leads/${moving.lead.id}/presales?tab=conversion`}>
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
            <Button
              disabled={loading || (moving?.stage === 7 && outcome === "won")}
              className="w-full"
            >
              {loading ? "Saving…" : "Confirm stage change"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
