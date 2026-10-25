import { sql, type SQL } from "drizzle-orm";
import type { Database } from "../db";
import type { Access } from "../auth/access";
import { AccessError } from "../auth/access";
import { leads, orders } from "../db/schema";
import { dates, leadWhere, moduleAccess, orderWhere, grace } from "./scope";
import type { Filters, Report } from "./validation";
export type Row = Record<string, string | number | null>;
export async function query<T = Row>(db: Database, q: SQL): Promise<T[]> {
  const r = await db.execute(q);
  return ("rows" in r ? r.rows : r) as unknown as T[];
}
export function ctes(a: Access, f: Filters, date = true) {
  return sql`with vl as (select ${leads}.* from ${leads} where ${leadWhere(a, f, date)}), vo as (select ${orders}.*,${leads.clientName} as client,${leads.territory} as territory,${leads.financialYear} as financial_year,${leads.assignedTo} as executive_id from ${orders} inner join ${leads} on ${leads.id}=${orders.leadId} where ${orderWhere(a, f, date)})`;
}
export const reportColumns: Record<Report, Record<string, string>> = {
  sales: {
    company: "Company",
    leads: "Leads",
    won: "Won leads",
    lost: "Lost leads",
    conversion: "Conversion %",
    pipeline: "Pipeline value INR",
    orders: "Orders",
    confirmed: "Confirmed value INR",
  },
  employees: {
    employee: "Sales executive",
    leads: "Assigned leads",
    won: "Won",
    lost: "Lost",
    conversion: "Conversion %",
    pending: "Pending follow-ups",
    confirmed: "Confirmed value INR",
  },
  conversion: {
    company: "Company",
    stage: "Pre-sales stage",
    outcome: "Outcome",
    leads: "Leads",
    expected: "Expected value INR",
  },
  quotations: {
    company: "Company",
    client: "Customer",
    revision: "Version",
    amount: "Amount INR",
    previous: "Previous INR",
    change: "Change INR",
    reason: "Revision reason",
    employee: "Issued by",
    date: "Issued at",
  },
  production: {
    company: "Company",
    client: "Customer",
    load: "Load",
    status: "Status",
    quantity: "Allocated quantity",
    installed: "Installed quantity",
    owner: "Owner",
    ready: "Site ready",
    start: "Production start",
    estimate: "Estimated completion",
    delayed: "Delayed",
    completed: "Completed",
  },
  payments: {
    company: "Company",
    client: "Customer",
    amount: "Received INR",
    status: "Verification",
    allocated: "Allocated INR",
    mode: "Mode",
    reference: "Reference",
    date: "Payment date",
    verifier: "Verified by",
    verified: "Verified at",
  },
  dispatch: {
    company: "Company",
    client: "Customer",
    load: "Load",
    reference: "Consignment",
    status: "Status",
    planned: "Planned dispatch",
    shipped: "Dispatched",
    expected: "Expected delivery",
    delayed: "Dispatch delayed",
    transporter: "Transporter",
  },
  installation: {
    company: "Company",
    client: "Customer",
    load: "Load",
    team: "Team",
    status: "Status",
    quantity: "Load quantity",
    installed: "Installed",
    pending: "Pending",
    planned: "Planned start",
    started: "Actual start",
    completed: "Completed",
  },
  audits: {
    company: "Company",
    client: "Customer",
    load: "Load",
    engineer: "Engineer",
    status: "Status",
    planned: "Planned date",
    inspection: "Inspected",
    punches: "Open punch items",
    approver: "Approver",
    approved: "Approved at",
  },
  handover: {
    company: "Company",
    client: "Customer",
    status: "Status",
    loads: "Required loads",
    complete: "Completed loads",
    date: "Handover date",
    accepted: "Customer accepted",
    representative: "Representative",
    reference: "Acceptance reference",
  },
};
export function reportQuery(a: Access, f: Filters, type: Report): SQL {
  const entityReport = [
      "production",
      "payments",
      "dispatch",
      "installation",
      "audits",
      "handover",
    ].includes(type),
    status = (c: SQL) =>
      !f.status
        ? sql`true`
        : f.status === "active"
          ? sql`${c}<>'completed'`
          : sql`${c}=${f.status}`;
  if (
    type === "payments" &&
    !moduleAccess(a, "payments.manage").assignments.some(
      (x) => !f.organizationId || x.organizationId === f.organizationId,
    )
  )
    throw new AccessError(403, "Payment permission is required for collection reports and exports");
  const actor = type === "payments" ? moduleAccess(a, "payments.manage") : a;
  const base = ctes(
    actor,
    entityReport ? { ...f, status: "" } : f,
    !["payments", "quotations"].includes(type),
  );
  if (type === "sales")
    return sql`${base}, lg as(select organization_id,count(*) as leads,count(*) filter(where outcome='won') as won,count(*) filter(where outcome='lost') as lost,coalesce(sum(expected_value) filter(where outcome is null),0) as pipeline from vl group by organization_id),og as(select organization_id,count(*) as orders,sum(final_value) as confirmed from vo group by organization_id) select g.id::text as id,g.name as company,coalesce(l.leads,0)::text as leads,coalesce(l.won,0)::text as won,coalesce(l.lost,0)::text as lost,coalesce(round(100.0*l.won/nullif(l.leads,0),2),0)::text as conversion,coalesce(l.pipeline,0)::text as pipeline,coalesce(o.orders,0)::text as orders,coalesce(o.confirmed,0)::text as confirmed from organizations g left join lg l on l.organization_id=g.id left join og o on o.organization_id=g.id where l.organization_id is not null or o.organization_id is not null`;
  if (type === "employees")
    return sql`${base}, lg as(select assigned_to as id,count(*) as leads,count(*) filter(where outcome='won') as won,count(*) filter(where outcome='lost') as lost from vl group by assigned_to),fg as(select t.assigned_to as id,count(*) as pending from lead_follow_ups t join vl l on l.id=t.lead_id where t.state='pending' group by t.assigned_to),og as(select executive_id as id,sum(final_value) as confirmed from vo group by executive_id),ids as(select id from lg union select id from og union select id from fg) select ids.id,coalesce(u.name,'Unassigned') as employee,coalesce(l.leads,0)::text as leads,coalesce(l.won,0)::text as won,coalesce(l.lost,0)::text as lost,coalesce(round(100.0*l.won/nullif(l.leads,0),2),0)::text as conversion,coalesce(f.pending,0)::text as pending,coalesce(o.confirmed,0)::text as confirmed from ids left join lg l on l.id=ids.id left join fg f on f.id=ids.id left join og o on o.id=ids.id left join "user" u on u.id=ids.id`;
  if (type === "conversion")
    return sql`${base} select concat(l.organization_id,':',l.stage,':',coalesce(l.outcome,'active')) as id,g.name as company,l.stage::text as stage,coalesce(l.outcome,'active') as outcome,count(*)::text as leads,coalesce(sum(l.expected_value),0)::text as expected from vl l join organizations g on g.id=l.organization_id group by l.organization_id,g.name,l.stage,l.outcome`;
  if (type === "quotations")
    return sql`${base}, versions as(select q.*,lag(q.amount) over(partition by q.lead_id order by q.revision) as previous from quotations q join vl l on l.id=q.lead_id) select q.id::text as id,g.name as company,l.client_name as client,concat('V',q.revision) as revision,q.amount::text as amount,q.previous::text as previous,(q.amount-q.previous)::text as change,q.revision_reason as reason,u.name as employee,q.created_at::text as date from versions q join vl l on l.id=q.lead_id join organizations g on g.id=q.organization_id left join "user" u on u.id=q.created_by where ${dates(sql`q.created_at`, f) ?? sql`true`}`;
  if (type === "production")
    return sql`${base} select l.id::text as id,g.name as company,o.client,concat('Load ',l.load_number) as load,l.status,(select coalesce(sum(quantity),0)::text from production_load_items where load_id=l.id) as quantity,(select coalesce(sum(installed_quantity),0)::text from production_load_items where load_id=l.id) as installed,u.name as owner,case when l.site_ready then 'Yes' else 'No' end as ready,l.data->>'in_productionAt' as start,l.data->>'estimatedCompletionAt' as estimate,case when l.status in ('planned','released','in_production') and nullif(l.data->>'estimatedCompletionAt','')::timestamptz+${grace("production", sql`l.organization_id`)}<now() then 'Yes' else 'No' end as delayed,l.completed_at::text as completed from production_loads l join vo o on o.id=l.order_id join organizations g on g.id=l.organization_id left join "user" u on u.id=l.assigned_to where ${status(sql`l.status`)} and exists(select 1 from production_load_items where load_id=l.id)`;
  if (type === "payments")
    return sql`${base} select p.id::text as id,g.name as company,o.client,p.amount::text as amount,p.status,p.allocated_amount::text as allocated,p.mode,p.reference,p.received_at::text as date,u.name as verifier,p.verified_at::text as verified from payments p join vo o on o.id=p.order_id join organizations g on g.id=p.organization_id left join "user" u on u.id=p.verified_by where ${status(sql`p.status`)} and ${dates(sql`p.received_at`, f) ?? sql`true`}`;
  if (type === "dispatch")
    return sql`${base} select d.id::text as id,g.name as company,o.client,concat('Load ',l.load_number) as load,d.reference,d.status,s.planned_at::text as planned,d.dispatched_at::text as shipped,d.expected_at::text as expected,case when d.status<>'cancelled' and s.planned_at+${grace("dispatch", sql`d.organization_id`)}<coalesce(d.dispatched_at,now()) then 'Yes' else 'No' end as delayed,d.transporter from dispatches d join vo o on o.id=d.order_id join production_loads l on l.id=d.load_id join organizations g on g.id=d.organization_id left join order_stages s on s.order_id=o.id and s.number=10 where ${status(sql`d.status`)}`;
  if (type === "installation")
    return sql`${base}, quantities as(select i.load_id,sum(i.quantity) as quantity,sum(i.installed_quantity) as installed from production_load_items i join production_loads l on l.id=i.load_id join vo o on o.id=l.order_id group by i.load_id) select l.id::text as id,g.name as company,o.client,concat('Load ',l.load_number) as load,i.team_name as team,coalesce(i.status,'not_scheduled') as status,q.quantity::text as quantity,q.installed::text as installed,(q.quantity-q.installed)::text as pending,i.planned_at::text as planned,i.started_at::text as started,i.completed_at::text as completed from production_loads l join vo o on o.id=l.order_id join organizations g on g.id=l.organization_id join quantities q on q.load_id=l.id left join installations i on i.load_id=l.id where ${status(sql`coalesce(i.status,'planned')`)}`;
  if (type === "audits")
    return sql`${base} select l.id::text as id,g.name as company,o.client,concat('Load ',l.load_number) as load,u.name as engineer,coalesce(a.status,'not_scheduled') as status,a.planned_at::text as planned,a.inspection_at::text as inspection,(select count(*)::text from audit_punch_items p where p.audit_id=a.id and p.status='open') as punches,ap.name as approver,a.completed_at::text as approved from production_loads l join vo o on o.id=l.order_id join organizations g on g.id=l.organization_id left join installations i on i.load_id=l.id left join engineer_audits a on a.installation_id=i.id left join "user" u on u.id=a.engineer_id left join "user" ap on ap.id=a.approved_by where exists(select 1 from production_load_items where load_id=l.id) and ${status(sql`coalesce(a.status,'planned')`)}`;
  return sql`${base} select o.id::text as id,g.name as company,o.client,coalesce(h.status,'not_prepared') as status,(select count(*)::text from production_loads l where l.order_id=o.id and exists(select 1 from production_load_items where load_id=l.id)) as loads,(select count(*)::text from production_loads l where l.order_id=o.id and l.status='completed') as complete,h.completed_at::text as date,case when h.customer_accepted then 'Yes' else 'No' end as accepted,h.customer_representative as representative,h.acceptance_reference as reference from vo o join organizations g on g.id=o.organization_id left join handovers h on h.order_id=o.id where ${status(sql`coalesce(h.status,'draft')`)}`;
}
