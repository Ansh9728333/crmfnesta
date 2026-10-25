import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarClock, Leaf, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { preSalesStages } from "@/lib/domain/workflows";
import type { Directory, LeadList, Summary } from "@/features/leads/types";
import { dateTime, money } from "@/features/leads/utils";
export function PreSalesOverview({
  name,
  directory,
  summary,
  recent,
  organizationId = "",
}: {
  name: string;
  directory: Directory;
  summary: Summary;
  recent: LeadList;
  organizationId?: string;
}) {
  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
            YOUR BUSINESS, IN VIEW
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            A clear view of what’s next.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Welcome, {name}. Your opportunities and next steps, together.
          </p>
        </div>
        <form className="flex gap-2">
          <select
            aria-label="Company dashboard filter"
            name="organizationId"
            className="rounded-lg border bg-white px-3 text-xs"
            defaultValue={organizationId}
          >
            <option value="">All authorized companies</option>
            {directory.organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm">
            Apply
          </Button>
        </form>
      </header>
      <section className="relative overflow-hidden rounded-2xl bg-primary p-7 text-white sm:p-9">
        <div className="absolute -right-10 -top-20 size-72 rounded-full border-[44px] border-white/5" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/70">
              <Leaf size={15} /> Relationships in motion
            </p>
            <h2 className="mt-3 text-2xl font-medium">From first hello to a confident decision.</h2>
            <p className="mt-3 max-w-xl text-xs leading-6 text-white/70">
              Keep each enquiry connected to its customer, project and next action.
            </p>
          </div>
          <Button asChild className="bg-[#dce9bf] text-primary hover:bg-[#e8f1d6]">
            <Link href="/leads">
              Open sales pipeline <ArrowUpRight size={16} />
            </Link>
          </Button>
        </div>
      </section>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          ["Active leads", summary.open],
          ["Pipeline value", money(summary.pipelineValue)],
          ["Won", summary.won],
          ["Lost", summary.lost],
          ["Overdue follow-ups", summary.overdue],
        ].map(([label, value]) => (
          <section key={label} className="rounded-xl border bg-white p-5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-4 text-2xl font-semibold">{value}</p>
          </section>
        ))}
      </div>
      <section className="overflow-hidden rounded-xl border bg-white">
        <header className="flex items-center justify-between border-b p-5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Users size={16} className="text-primary" /> Recent opportunities
            </h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Live records within your authorized companies and branches.
            </p>
          </div>
          <Link
            href="/leads?view=table"
            className="flex items-center gap-2 text-xs font-semibold text-primary"
          >
            View all <ArrowRight size={14} />
          </Link>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="bg-background text-[10px] uppercase text-muted-foreground">
              <tr>
                {["Client / Project", "Company", "Stage", "Value", "Next follow-up"].map((h) => (
                  <th key={h} className="px-5 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.rows.map((lead) => (
                <tr key={lead.id} className="border-t">
                  <td className="px-5 py-5">
                    <Link className="font-semibold text-primary" href={`/leads/${lead.id}`}>
                      {lead.clientName}
                    </Link>
                    <p className="mt-1 text-muted-foreground">{lead.projectName}</p>
                  </td>
                  <td className="px-5 py-5">
                    <Badge variant="secondary">{lead.companyName}</Badge>
                  </td>
                  <td className="max-w-44 px-5 py-5 leading-5">{preSalesStages[lead.stage - 1]}</td>
                  <td className="px-5 py-5 font-medium">{money(lead.expectedValue)}</td>
                  <td className="px-5 py-5">
                    <span className="flex items-center gap-2">
                      <CalendarClock size={13} />
                      {dateTime(lead.nextFollowUp)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!recent.rows.length && (
            <div className="p-12 text-center">
              <h3 className="text-base font-semibold">Room for your next relationship.</h3>
              <p className="mt-3 text-xs text-muted-foreground">
                No leads match this company selection. Capture a new enquiry to begin.
              </p>
              <Button asChild variant="outline" className="mt-5">
                <Link href="/leads">
                  Go to leads <ArrowRight size={14} />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
