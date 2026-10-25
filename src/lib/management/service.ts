import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db";
import { buildAuth, type AuthSettings } from "../auth/config";
import { AccessError, resolveAccess, type Access } from "../auth/access";
import * as s from "../db/schema";
import { eligibleAssignments, leadScope } from "../leads/access";
import { filterSchema, reports, type Filters, type Report } from "./validation";
import { ctes, query, reportColumns, reportQuery } from "./queries";
import { reportAccess, moduleAccess, grace } from "./scope";
import { encodeReport } from "./export";
export const reportStatuses: Record<Report, string[]> = {
  sales: ["active", "won", "lost", "completed"],
  employees: ["active", "won", "lost", "completed"],
  conversion: ["active", "won", "lost"],
  quotations: ["active", "won", "lost"],
  production: [
    "active",
    "completed",
    "planned",
    "released",
    "in_production",
    "factory_ready",
    "dispatched",
    "delivered",
    "installation_started",
    "installed",
    "audit_passed",
  ],
  payments: ["pending", "verified", "rejected"],
  dispatch: ["draft", "approved", "dispatched", "partially_delivered", "delivered", "cancelled"],
  installation: ["planned", "in_progress", "completed"],
  audits: ["planned", "in_progress", "submitted", "changes_required", "approved"],
  handover: ["draft", "confirmed"],
};
const permitted = (
  a: Access,
  p: "leads.read" | "orders.read" | "payments.manage",
  organizationId = "",
) => eligibleAssignments(a, p).some((x) => !organizationId || x.organizationId === organizationId);
export function managementService(db: Database, settings: AuthSettings) {
  const access = (h: Headers, tx = db) => resolveAccess(tx, buildAuth(tx, settings), h);
  async function report(tx: Database, a: Access, type: Report, f: Filters, exporting = false) {
    if (f.status && !reportStatuses[type].includes(f.status))
      throw new AccessError(400, "Status is not applicable to this report");
    const q = reportQuery(a, f, type);
    const [{ total }] = await query<{ total: string }>(
      tx,
      sql`select count(*)::text as total from (${q}) result`,
    );
    if (exporting && Number(total) > 10000)
      throw new AccessError(
        413,
        "Exports support 10,000 rows. Narrow the filters before exporting",
      );
    const rows = await query(
      tx,
      sql`select * from (${q}) result order by id limit ${exporting ? 10000 : 25} offset ${exporting ? 0 : (f.page - 1) * 25}`,
    );
    return {
      type,
      title: reports[type],
      columns: reportColumns[type],
      rows,
      total: Number(total),
      page: f.page,
      filters: f,
    };
  }
  return {
    async directory(h: Headers) {
      const a = reportAccess(await access(h)),
        ids = [...new Set(a.assignments.map((x) => x.organizationId))];
      const companies = await db
        .select({ id: s.organizations.id, name: s.organizations.name })
        .from(s.organizations)
        .where(inArray(s.organizations.id, ids));
      const employees = await db
        .selectDistinct({ id: s.user.id, name: s.user.name })
        .from(s.user)
        .innerJoin(s.employeeRoleAssignments, eq(s.employeeRoleAssignments.userId, s.user.id))
        .where(
          or(
            ...a.assignments.map((x) =>
              and(
                eq(s.employeeRoleAssignments.organizationId, x.organizationId),
                ["Admin", "Super Admin"].includes(x.role)
                  ? undefined
                  : eq(s.employeeRoleAssignments.centreId, x.centreId),
              ),
            ),
          ),
        );
      const territories = await db
        .selectDistinct({ name: s.leads.territory })
        .from(s.leads)
        .where(and(leadScope(a), isNull(s.leads.archivedAt)));
      const financialYears = await db
        .selectDistinct({ name: s.leads.financialYear })
        .from(s.leads)
        .where(and(leadScope(a), isNull(s.leads.archivedAt)));
      return {
        companies,
        employees,
        territories: territories.flatMap((x) => (x.name ? [x.name] : [])).sort(),
        financialYears: financialYears
          .flatMap((x) => (x.name ? [x.name] : []))
          .sort()
          .reverse(),
        financial: permitted(a, "payments.manage"),
        financialCompanyIds: [
          ...new Set(eligibleAssignments(a, "payments.manage").map((x) => x.organizationId)),
        ],
      };
    },
    async dashboard(h: Headers, raw: unknown = {}) {
      const a = reportAccess(await access(h)),
        f = filterSchema.parse(raw);
      if (f.status && !["active", "won", "lost", "completed"].includes(f.status))
        throw new AccessError(400, "Choose a lifecycle status for the dashboard");
      const [lead] = await query(
        db,
        sql`${ctes(a, f)} select count(*)::text as total_leads,count(*) filter(where outcome is null)::text as active_leads,count(*) filter(where outcome='lost')::text as lost_orders,coalesce(round(100.0*count(*) filter(where outcome='won')/nullif(count(*),0),2),0)::text as conversion_rate,coalesce(sum(expected_value) filter(where outcome is null),0)::text as expected_pipeline_value,(select count(*)::text from lead_follow_ups t join vl l on l.id=t.lead_id where t.state='pending') as pending_follow_ups from vl`,
      );
      const [order] = await query(
        db,
        sql`${ctes(a, f)}, loads as(select l.* from production_loads l join vo o on o.id=l.order_id where exists(select 1 from production_load_items where load_id=l.id)) select (select count(*)::text from vo) as won_orders,(select coalesce(sum(final_value),0)::text from vo) as confirmed_order_value,(select count(distinct order_id)::text from order_stages where order_id in(select id from vo) and number in(3,4) and status<>'completed') as pending_surveys,(select count(distinct order_id)::text from loads where status in('released','in_production','factory_ready')) as orders_in_production,(select count(*)::text from loads where status<>'completed') as active_production_loads,(select count(*)::text from loads l where l.status in('planned','released','in_production') and nullif(l.data->>'estimatedCompletionAt','')::timestamptz+${grace("production", sql`l.organization_id`)}<now()) as delayed_production_loads,(select count(*)::text from loads l where l.status in('factory_ready','dispatched') and (exists(select 1 from production_load_items i where i.load_id=l.id and i.dispatched_quantity<i.quantity) or exists(select 1 from dispatches d where d.load_id=l.id and d.status in('draft','approved')))) as pending_dispatches,(select count(*)::text from loads where status in('delivered','installation_started')) as pending_installations,(select count(*)::text from loads where status='installed') as pending_engineer_audits,(select count(*)::text from vo o where o.stage=15 and not exists(select 1 from handovers h where h.order_id=o.id and h.status='confirmed')) as pending_site_handovers,(select count(*)::text from service_tickets t join vo o on o.id=t.order_id where t.status not in('resolved','closed')) as open_service_tickets`,
      );
      const [financial] = await query(
        db,
        sql`${ctes(moduleAccess(a, "payments.manage"), f)} select (select coalesce(sum(p.amount),0)::text from payments p join vo o on o.id=p.order_id where p.status='verified') as payments_received,(select coalesce(sum(greatest(coalesce(o.final_value,0)-(select coalesce(sum(p.amount),0) from payments p where p.order_id=o.id and p.status='verified'),0)),0)::text from vo o) as outstanding_payments`,
      );
      const available = {
        leads: permitted(a, "leads.read", f.organizationId),
        orders: permitted(a, "orders.read", f.organizationId),
        financial: permitted(a, "payments.manage", f.organizationId),
      };
      return {
        filters: f,
        available,
        kpis: {
          ...Object.fromEntries(
            Object.entries(lead).map(([k, v]) => [k, available.leads ? v : null]),
          ),
          ...Object.fromEntries(
            Object.entries(order).map(([k, v]) => [k, available.orders ? v : null]),
          ),
          ...Object.fromEntries(
            Object.entries(financial).map(([k, v]) => [k, available.financial ? v : null]),
          ),
        },
        companies: await report(db, a, "sales", { ...f, page: 1 }),
      };
    },
    async report(h: Headers, typeRaw: string, raw: unknown) {
      const type = z.enum(Object.keys(reports) as [Report, ...Report[]]).parse(typeRaw),
        a = reportAccess(await access(h));
      return report(db, a, type, filterSchema.parse(raw));
    },
    async export(h: Headers, typeRaw: string, raw: unknown, format: "csv" | "xlsx") {
      const type = z.enum(Object.keys(reports) as [Report, ...Report[]]).parse(typeRaw),
        f = filterSchema.parse(raw);
      return db.transaction(async (t) => {
        const tx = t as unknown as Database;
        await tx.execute(sql`select pg_advisory_xact_lock(73190021)`);
        const a = reportAccess(await access(h, tx)),
          r = await report(tx, a, type, f, true);
        const bytes = await encodeReport(r, format);
        for (const org of [...new Set(a.assignments.map((x) => x.organizationId))].filter(
          (id) => !f.organizationId || id === f.organizationId,
        ))
          await tx.insert(s.auditLogs).values({
            organizationId: org,
            actorId: a.user.id,
            targetId: type,
            action: "report.exported",
            metadata: { format, filters: f, rows: r.total },
          });
        return {
          bytes,
          name: `siteflow-${type}.${format}`,
          contentType:
            format === "csv"
              ? "text/csv; charset=utf-8"
              : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        };
      });
    },
  };
}
