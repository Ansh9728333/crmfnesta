"use client";
import Link from "next/link";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { MetricCard, type MetricTone } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { requestJson, dateTime } from "@/features/leads/utils";
import { labels, priorities, statuses } from "@/lib/help-tickets/validation";
import type { Directory, TicketList, TicketDetail } from "./types";
import { Field, selectClass } from "./shared";
import { CreateTicket } from "./create-ticket";
import { TicketDetailView } from "./detail";
export function HelpDashboard({
  data: d,
  directory,
  query: q,
}: {
  data: TicketList;
  directory: Directory;
  query: Record<string, string | undefined>;
}) {
  const opener = useRef<HTMLButtonElement | null>(null);
  const router = useRouter(),
    [detail, setDetail] = useState<TicketDetail | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const href = (patch: Record<string, string | number>) =>
    `/help-tickets?${new URLSearchParams({ ...Object.fromEntries(Object.entries(q).filter((x): x is [string, string] => typeof x[1] === "string" && !["kind", "sourceId"].includes(x[0]))), ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, String(v)])) })}`;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Customer support workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Help Tickets</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            One concern, one owner, a confirmed resolution.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {directory.adminOrganizations.length > 0 && (
            <Button asChild variant="outline">
              <Link href="/help-tickets/settings">Concern types &amp; SLA</Link>
            </Button>
          )}
          {directory.canRaise && <CreateTicket directory={directory} />}
        </div>
      </header>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Matching tickets", d.total],
          ["Open", d.open],
          ["Awaiting confirmation", d.confirmation],
          ["Overdue", d.overdue],
        ].map(([label, value], i) => (
          <MetricCard
            key={label}
            label={String(label)}
            value={value}
            tone={(["red", "blue", "amber", "green"] as MetricTone[])[i]}
            solid
            icon={CircleHelp}
          />
        ))}
      </div>
      <nav aria-label="Help ticket views" className="flex flex-wrap gap-2">
        {[
          ["all", "All accessible"],
          ["raised", "My Raised"],
          ["assigned", "Assigned to Me"],
          ["confirmation", "Awaiting My Confirmation"],
          ["reopened", "Reopened"],
          ["overdue", "Overdue"],
        ].map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={(q.tab ?? "all") === value ? "default" : "outline"}
            asChild
          >
            <Link href={href({ tab: value, page: 1 })}>{label}</Link>
          </Button>
        ))}
      </nav>
      <form className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2 lg:grid-cols-4">
        <input type="hidden" name="tab" value={q.tab ?? "all"} />
        <Field label="Client, ticket or problem">
          <Input name="q" defaultValue={q.q} maxLength={100} placeholder="Search tickets" />
        </Field>
        <Field label="Company">
          <select
            name="organizationId"
            defaultValue={q.organizationId ?? ""}
            className={selectClass}
          >
            <option value="">All companies</option>
            {directory.companies.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Location">
          <select name="centreId" defaultValue={q.centreId ?? ""} className={selectClass}>
            <option value="">All locations</option>
            {directory.centres.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} · {directory.companies.find((c) => c.id === x.organizationId)?.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select className={selectClass} name="status" defaultValue={q.status ?? ""}>
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {labels[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select className={selectClass} name="priority" defaultValue={q.priority ?? ""}>
            <option value="">All priorities</option>
            {priorities.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Resolver">
          <select name="resolver" className={selectClass} defaultValue={q.resolver ?? ""}>
            <option value="">All resolvers</option>
            {directory.filterResolvers.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="From date (IST)">
          <Input type="date" name="from" defaultValue={q.from} />
        </Field>
        <Field label="To date (IST)">
          <Input type="date" name="to" defaultValue={q.to} />
        </Field>
        <div className="flex items-end gap-2">
          <Button>Apply filters</Button>
          <Button asChild variant="outline">
            <Link href="/help-tickets">Clear</Link>
          </Button>
        </div>
      </form>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {loading && (
        <p role="status" className="text-sm">
          Loading ticket…
        </p>
      )}
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="border-b bg-muted">
              <tr>
                {[
                  "Ticket / Client",
                  "Company / Location",
                  "Concern",
                  "Raised by / Resolver",
                  "Priority",
                  "Status",
                  "Target",
                ].map((h) => (
                  <th key={h} className="p-4 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.rows.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-4">
                    <button
                      type="button"
                      className="font-semibold text-primary underline"
                      onClick={async (e) => {
                        opener.current = e.currentTarget;
                        setLoading(true);
                        setError("");
                        try {
                          setDetail(await requestJson(`/api/help-tickets/${t.id}`));
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      {t.number}
                    </button>
                    <p className="mt-2 font-medium">{t.client}</p>
                  </td>
                  <td className="p-4">
                    {t.company}
                    <p className="mt-1 text-muted-foreground">{t.location}</p>
                  </td>
                  <td className="p-4">{t.concern}</td>
                  <td className="p-4">
                    {t.creator}
                    <p className="mt-1 text-muted-foreground">→ {t.resolver}</p>
                  </td>
                  <td className="p-4">
                    <Badge variant="outline">{t.priority}</Badge>
                  </td>
                  <td className="p-4">
                    <Badge variant="secondary">{labels[t.status]}</Badge>
                  </td>
                  <td className="p-4">{t.due_at ? dateTime(t.due_at) : "Not configured"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!d.rows.length && (
          <div className="p-12 text-center">
            <h2 className="font-semibold">No matching help tickets</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Raise a ticket from an existing lead or project, or adjust your filters.
            </p>
          </div>
        )}
        <footer className="flex items-center justify-between gap-3 border-t p-4 text-xs">
          <span>
            {d.total} tickets · Page {d.page} of {Math.max(1, Math.ceil(d.total / 20))}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={d.page <= 1}
              onClick={() => router.push(href({ page: d.page - 1 }))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={d.page * 20 >= d.total}
              onClick={() => router.push(href({ page: d.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </footer>
      </section>
      <Sheet
        open={Boolean(detail)}
        onOpenChange={(v) => {
          if (!v) setDetail(null);
        }}
      >
        <SheetContent
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            opener.current?.focus();
          }}
          className="w-full overflow-y-auto p-5 sm:max-w-2xl"
        >
          <SheetTitle>Help Ticket Details</SheetTitle>
          <SheetDescription>Concern, resolution and complete activity history.</SheetDescription>
          {detail && (
            <TicketDetailView
              key={detail.ticket.id}
              initial={detail}
              onChanged={() => router.refresh()}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
