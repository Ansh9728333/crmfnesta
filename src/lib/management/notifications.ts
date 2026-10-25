import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db";
import { buildAuth, type AuthSettings } from "../auth/config";
import { AccessError, resolveAccess, type Access } from "../auth/access";
import type { Permission } from "../auth/roles";
import { eligibleAssignments } from "../leads/access";
import { auditLogs, notificationReceipts } from "../db/schema";
import { ctes, query } from "./queries";
import { filterSchema, notificationAction } from "./validation";
import { grace } from "./scope";
import { helpTaskSource } from "../help-tickets/access";
const relevant = (a: Access, permissions: Permission[]) => ({
  ...a,
  assignments: a.assignments.filter((x) =>
    permissions.some((p) => eligibleAssignments(a, p).includes(x)),
  ),
});
function sources(a: Access): SQL {
  const f = filterSchema.parse({});
  const one = (actor: Access, body: SQL) => sql`(${ctes(actor, f)} ${body})`;
  return sql`${one(a, sql`select t.organization_id,t.id as entity_id,'follow_up'::text as kind,'Overdue follow-up'::text as title,l.client_name as client,'/leads/'||l.id as href,t.due_at+${grace("follow_up", sql`t.organization_id`)} as due_at from lead_follow_ups t join vl l on l.id=t.lead_id where t.state='pending' and l.outcome is null`)} union all
 ${one(relevant(a, ["production.manage", "orders.manage"]), sql`select l.organization_id,l.id,'production','Production load delayed',o.client,'/production/'||l.id,nullif(l.data->>'estimatedCompletionAt','')::timestamptz+${grace("production", sql`l.organization_id`)} from production_loads l join vo o on o.id=l.order_id where l.status in('planned','released','in_production') and exists(select 1 from production_load_items where load_id=l.id)`)} union all
 ${one(relevant(a, ["payments.manage"]), sql`select p.organization_id,p.id,'payment','Payment milestone overdue',o.client,'/payments?orderId='||o.id,p.due_at+${grace("payment", sql`p.organization_id`)} from payment_milestones p join vo o on o.id=p.order_id where p.allocated_amount<p.amount`)} union all
 ${one(relevant(a, ["installations.manage", "orders.manage"]), sql`select l.organization_id,l.id,'installation','Installation delayed',o.client,'/installations?orderId='||o.id,case when i.status='in_progress' then finish.planned_at else coalesce(i.planned_at,start.planned_at) end+${grace("installation", sql`l.organization_id`)} from production_loads l join vo o on o.id=l.order_id left join installations i on i.load_id=l.id left join order_stages start on start.order_id=o.id and start.number=12 left join order_stages finish on finish.order_id=o.id and finish.number=13 where l.status in('delivered','installation_started')`)} union all
 ${one(relevant(a, ["audits.manage", "orders.manage"]), sql`select l.organization_id,l.id,'audit','Engineer audit overdue',o.client,'/installations?orderId='||o.id,coalesce(a.planned_at,stage.planned_at)+${grace("audit", sql`l.organization_id`)} from production_loads l join vo o on o.id=l.order_id left join installations i on i.load_id=l.id left join engineer_audits a on a.installation_id=i.id left join order_stages stage on stage.order_id=o.id and stage.number=14 where l.status='installed' and coalesce(a.status,'planned')<>'approved'`)}`;
}
export function notificationService(db: Database, settings: AuthSettings) {
  const access = (h: Headers, tx = db) => resolveAccess(tx, buildAuth(tx, settings), h);
  return {
    async list(h: Headers, raw: unknown = {}) {
      const a = await access(h),
        f = z
          .object({
            page: z.coerce.number().int().min(1).max(100000).default(1),
            unread: z.enum(["", "yes"]).default(""),
            mode: z.enum(["", "count"]).default(""),
          })
          .parse(raw),
        q = sql`${sources(a)} union all ${helpTaskSource(a)}`;
      const visible = sql`from (${q}) n left join notification_receipts r on r.user_id=${a.user.id} and r.kind=n.kind and r.entity_id=n.entity_id and r.due_at=n.due_at where n.due_at<now() and coalesce(r.state,'unread')<>'dismissed' ${f.unread === "yes" ? sql`and r.id is null` : sql``}`;
      const [{ total, unread }] = await query<{ total: string; unread: string }>(
        db,
        sql`select count(*)::text as total,count(*) filter(where r.id is null)::text as unread ${visible}`,
      );
      if (f.mode === "count")
        return { rows: [], total: Number(total), unread: Number(unread), page: f.page };
      const rows = await query<{
        organization_id: string;
        entity_id: string;
        kind: string;
        title: string;
        client: string;
        href: string;
        due_at: string;
        state: string;
      }>(
        db,
        sql`select n.*,coalesce(r.state,'unread') as state ${visible} order by n.due_at,n.kind,n.entity_id limit 20 offset ${(f.page - 1) * 20}`,
      );
      return {
        rows: rows.map((x) => ({ ...x, due_at: new Date(x.due_at).toISOString() })),
        total: Number(total),
        unread: Number(unread),
        page: f.page,
      };
    },
    async change(h: Headers, raw: unknown) {
      const input = notificationAction.parse(raw);
      return db.transaction(async (t) => {
        const tx = t as unknown as Database;
        await tx.execute(sql`select pg_advisory_xact_lock(73190021)`);
        const a = await access(h, tx),
          [n] = await query<{ organization_id: string }>(
            tx,
            sql`select organization_id from (${sources(a)} union all ${helpTaskSource(a)}) n where n.kind=${input.kind} and n.entity_id=${input.entityId} and n.due_at=${new Date(input.dueAt).toISOString()}::timestamptz and n.due_at<now()`,
          );
        if (!n) throw new AccessError(404, "Notification resolved or unavailable");
        await tx
          .insert(notificationReceipts)
          .values({
            organizationId: n.organization_id,
            userId: a.user.id,
            kind: input.kind,
            entityId: input.entityId,
            dueAt: new Date(input.dueAt),
            state: input.state,
          })
          .onConflictDoUpdate({
            target: [
              notificationReceipts.userId,
              notificationReceipts.kind,
              notificationReceipts.entityId,
            ],
            set: { dueAt: new Date(input.dueAt), state: input.state, updatedAt: new Date() },
          });
        await tx.insert(auditLogs).values({
          organizationId: n.organization_id,
          actorId: a.user.id,
          targetId: input.entityId,
          action: `notification.${input.state}`,
          metadata: { kind: input.kind, dueAt: input.dueAt },
        });
        return { state: input.state };
      });
    },
  };
}
