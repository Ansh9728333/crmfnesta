import Link from "next/link";
import { BarChart3, Bell, ShieldCheck, TrendingUp } from "lucide-react";
import { money } from "@/features/leads/utils";
import { ManagementFilters } from "./filters";
import { ReportTable } from "./report-table";
import type { Dashboard, Directory } from "./types";
const metrics: Record<string, string> = {
  total_leads: "Total Leads",
  active_leads: "Active Leads",
  won_orders: "Won Orders",
  lost_orders: "Lost Orders",
  conversion_rate: "Conversion Rate",
  expected_pipeline_value: "Expected Pipeline Value",
  confirmed_order_value: "Confirmed Order Value",
  pending_follow_ups: "Pending Follow-ups",
  pending_surveys: "Pending Surveys",
  orders_in_production: "Orders in Production",
  active_production_loads: "Active Production Loads",
  delayed_production_loads: "Delayed Production Loads",
  payments_received: "Payments Received",
  outstanding_payments: "Outstanding Payments",
  pending_dispatches: "Pending Dispatches",
  pending_installations: "Pending Installations",
  pending_engineer_audits: "Pending Engineer Audits",
  pending_site_handovers: "Pending Site Handovers",
  open_service_tickets: "Open Service Tickets",
};
export function ManagementDashboard({
  data: d,
  directory,
  name,
}: {
  data: Dashboard;
  directory: Directory;
  name: string;
}) {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Business performance
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Management dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Welcome, {name}. Follow sales, fulfillment and customer care across your permitted
            records.
          </p>
        </div>
        <nav className="flex flex-wrap gap-4 text-sm underline">
          <Link href="/reports">
            <BarChart3 className="mr-1 inline size-4" />
            Reports
          </Link>
          <Link href="/notifications">
            <Bell className="mr-1 inline size-4" />
            Notifications
          </Link>
          <Link href="/settings">
            <ShieldCheck className="mr-1 inline size-4" />
            Admin Panel
          </Link>
        </nav>
      </header>
      <ManagementFilters directory={directory} f={d.filters} />
      <section className="rounded-2xl bg-primary p-6 text-white sm:p-8">
        <TrendingUp className="mb-3 size-6" />
        <h2 className="text-xl font-medium">From first enquiry to customer handover.</h2>
        <p className="mt-3 max-w-3xl text-xs leading-6 text-white/80">
          Conversion = won leads ÷ total non-archived leads. Lead dates and order dates define the
          selected cohorts. Verified payments and outstanding balances cover those orders. Financial
          results require payment access.
        </p>
      </section>
      <section
        aria-label="Dashboard KPIs"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {Object.entries(metrics).map(([key, label]) => {
          const v = d.kpis[key];
          return (
            <article key={key} className="rounded-xl border bg-white p-5">
              <h2 className="text-xs font-medium text-muted-foreground">{label}</h2>
              <p className="mt-3 text-2xl font-semibold tabular-nums">
                {v === null
                  ? "Restricted"
                  : key === "conversion_rate"
                    ? `${v}%`
                    : [
                          "expected_pipeline_value",
                          "confirmed_order_value",
                          "payments_received",
                          "outstanding_payments",
                        ].includes(key)
                      ? money(String(v))
                      : v}
              </p>
            </article>
          );
        })}
      </section>
      <ReportTable data={d.companies} />
      <p className="text-xs leading-6 text-muted-foreground">
        Operational counts use allocated loads and recorded workflow states. Delays require a
        recorded target date and use the company’s SLA grace period. Date ranges are inclusive in
        IST. Review requests never require a positive review.
      </p>
    </div>
  );
}
