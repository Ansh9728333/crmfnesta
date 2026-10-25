import Link from "next/link";
import {
  BarChart3,
  Bell,
  ShieldCheck,
  Users,
  Activity,
  CircleCheck,
  CircleX,
  IndianRupee,
  CalendarClock,
  Factory,
  Truck,
  HardHat,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import { MetricCard, type MetricTone } from "@/components/ui/metric-card";
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
const icons: Record<string, LucideIcon> = {
  total_leads: Users,
  active_leads: Activity,
  won_orders: CircleCheck,
  lost_orders: CircleX,
  conversion_rate: BarChart3,
  pending_follow_ups: CalendarClock,
  pending_surveys: CalendarClock,
  orders_in_production: Factory,
  active_production_loads: Factory,
  delayed_production_loads: Factory,
  pending_dispatches: Truck,
  pending_installations: HardHat,
  pending_engineer_audits: ClipboardCheck,
  pending_site_handovers: ClipboardCheck,
  open_service_tickets: Bell,
};
function tone(key: string): MetricTone {
  if (
    [
      "lost_orders",
      "delayed_production_loads",
      "outstanding_payments",
      "open_service_tickets",
    ].includes(key)
  )
    return "red";
  if (["won_orders", "payments_received", "confirmed_order_value"].includes(key)) return "green";
  if (key.startsWith("pending_") || key === "active_leads") return "amber";
  return "blue";
}
function metricValue(key: string, value: string | number | null | undefined) {
  if (value === null || value === undefined) return "Restricted";
  if (key === "conversion_rate") return `${value}%`;
  if (
    [
      "expected_pipeline_value",
      "confirmed_order_value",
      "payments_received",
      "outstanding_payments",
    ].includes(key)
  )
    return money(String(value));
  return value;
}
function WorkloadPanels({ data }: { data: Dashboard }) {
  const queues = [
    "pending_follow_ups",
    "pending_surveys",
    "pending_dispatches",
    "pending_installations",
    "pending_engineer_audits",
  ];
  const maximum = Math.max(1, ...queues.map((key) => Number(data.kpis[key] ?? 0)));
  return (
    <div className="col-span-full grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <section className="rounded-xl border bg-white p-5 sm:p-6" aria-label="Operational workload">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Operational workload</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Pending records in your selected scope
            </p>
          </div>
          <BarChart3 size={21} className="text-[#285de5]" />
        </div>
        <div className="space-y-4">
          {queues.map((key, index) => (
            <div key={key}>
              <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                <span>{metrics[key]}</span>
                <strong className="tabular-nums">{data.kpis[key] ?? "Restricted"}</strong>
              </div>
              <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(Number(data.kpis[key] ?? 0) / maximum) * 100}%`,
                    backgroundColor: ["#285de5", "#d99c00", "#087f5b", "#c72239", "#8752c9"][index],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-xl border bg-white p-5 sm:p-6" aria-label="Collection summary">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Collection summary</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Verified receipts and selected order balances
            </p>
          </div>
          <IndianRupee size={21} className="text-[#087f5b]" />
        </div>
        <div className="space-y-3">
          {[
            ["payments_received", "Verified collections", "text-[#06664b] bg-[#e4f5ed]"],
            ["outstanding_payments", "Outstanding balance", "text-[#bd2036] bg-[#fcecf0]"],
            ["confirmed_order_value", "Confirmed business", "text-[#244ca3] bg-[#eaf0ff]"],
          ].map(([key, label, color]) => (
            <div key={key} className={`rounded-lg px-4 py-3 ${color}`}>
              <p className="text-[11px] font-medium">{label}</p>
              <p className="mt-1 break-words text-xl font-semibold tabular-nums">
                {metricValue(key, data.kpis[key])}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
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
      <section
        aria-label="Dashboard KPIs"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {Object.entries(metrics)
          .slice(0, 4)
          .map(([key, label]) => (
            <MetricCard
              key={key}
              label={label}
              value={metricValue(key, d.kpis[key])}
              tone={tone(key)}
              icon={icons[key] ?? IndianRupee}
              solid
            />
          ))}
        <WorkloadPanels data={d} />
        {Object.entries(metrics)
          .slice(4)
          .map(([key, label]) => (
            <MetricCard
              key={key}
              label={label}
              value={metricValue(key, d.kpis[key])}
              tone={tone(key)}
              icon={icons[key] ?? IndianRupee}
            />
          ))}
      </section>
      <ReportTable data={d.companies} />
      <p className="text-xs leading-6 text-muted-foreground">
        Conversion = won leads ÷ total non-archived leads. Lead dates and order dates define their
        selected cohorts. Operational counts use allocated loads and recorded workflow states.
        Delays require a recorded target date and use the company’s SLA grace period. Date ranges
        are inclusive in IST. Review requests never require a positive review.
      </p>
    </div>
  );
}
