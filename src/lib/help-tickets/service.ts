import { randomUUID } from "node:crypto";
import { and, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db";
import { buildAuth, type AuthSettings } from "../auth/config";
import {
  AccessError,
  adminOrganizations,
  resolveAccess,
  orderPredicate,
  type Access,
} from "../auth/access";
import { eligibleAssignments, leadScope, projectScope } from "../leads/access";
import {
  auditLogs,
  helpTickets,
  helpTicketEvents,
  helpTicketFiles,
  helpConcernPolicies,
  leads,
  projects,
  orders,
} from "../db/schema";
import { query } from "../management/queries";
import {
  actionSchema,
  createSchema,
  fileSchema,
  filterSchema,
  policySchema,
  sourceSchema,
  validFile,
} from "./validation";
import { helpScope } from "./access";

export interface HelpStore {
  prepare(path: string): Promise<{ signedUrl: string }>;
  read(path: string): Promise<Uint8Array>;
  sign(path: string): Promise<string>;
}
export type HelpSource = {
  kind: "lead" | "project" | "customer";
  id: string;
  organizationId: string;
  centreId: string;
  customerId: string;
  projectId: string | null;
  leadId: string | null;
  client: string;
  name: string;
  company: string;
  location: string;
  mobile: string | null;
};
export function helpService(db: Database, settings: AuthSettings, store?: HelpStore) {
  const access = (h: Headers, t = db) => resolveAccess(t, buildAuth(t, settings), h);
  function fail(status: number, message: string): never {
    throw new AccessError(status, message);
  }
  function allowed(a: Access, org: string, centre: string, permission: "help.read" | "help.raise") {
    void centre;
    return eligibleAssignments(a, permission).some((x) => x.organizationId === org);
  }
  function isResolver(a: Access, ticket: typeof helpTickets.$inferSelect) {
    return (
      ticket.assignedTo === a.user.id &&
      a.assignments.some((x) => x.organizationId === ticket.organizationId)
    );
  }
  async function transaction<T>(h: Headers, fn: (t: Database, a: Access) => Promise<T>) {
    return db.transaction(async (tx) => {
      const t = tx as unknown as Database;
      await t.execute(sql`select pg_advisory_xact_lock(73190021)`);
      return fn(t, await access(h, t));
    });
  }
  function projectVisibility(t: Database, a: Access) {
    const orderScopes = eligibleAssignments(a, "orders.read").map((x) =>
      orderPredicate(a, x.organizationId, "orders.read"),
    );
    return or(
      projectScope(t, a),
      sql`exists(select 1 from orders where ${orders.projectId}=${projects.id} and ${orders.organizationId}=${projects.organizationId} and ${or(...orderScopes) ?? sql`false`})`,
    )!;
  }
  async function sources(t: Database, a: Access, raw: unknown) {
    const f = z
      .object({
        q: z.string().trim().max(100).default(""),
        kind: z.enum(["lead", "project", "customer"]).optional(),
        id: z.uuid().optional(),
        organizationId: z.union([z.uuid(), z.literal("")]).default(""),
        customerId: z.uuid().optional(),
        page: z.coerce.number().int().min(1).max(100000).default(1),
      })
      .parse(raw);
    const branches = eligibleAssignments(a, "help.raise").filter((x) =>
      allowed(a, x.organizationId, x.centreId, "help.read"),
    );
    const orgs = [...new Set(branches.map((x) => x.organizationId))];
    if (!orgs.length) return [];
    const scope = (column: typeof leads.organizationId | typeof projects.organizationId) =>
      sql`${column} in (${sql.join(
        orgs.map((x) => sql`${x}::uuid`),
        sql`, `,
      )})`;
    const q = sql`select 'lead'::text as kind,leads.id,leads.organization_id as "organizationId",leads.centre_id as "centreId",leads.customer_id as "customerId",leads.project_id as "projectId",leads.id as "leadId",c.name as client,coalesce(p.name,'Lead enquiry') as name,o.name as company,b.name as location,coalesce(c.mobile,leads.mobile) as mobile from leads join customers c on c.id=leads.customer_id and c.organization_id=leads.organization_id join organizations o on o.id=leads.organization_id join centres b on b.id=leads.centre_id and b.active left join projects p on p.id=leads.project_id where ${scope(leads.organizationId)} and leads.archived_at is null
    union all select 'project',projects.id,projects.organization_id,projects.centre_id,projects.customer_id,projects.id,null,c.name,projects.name,o.name,b.name,c.mobile from projects join customers c on c.id=projects.customer_id and c.organization_id=projects.organization_id join organizations o on o.id=projects.organization_id join centres b on b.id=projects.centre_id and b.active where ${scope(projects.organizationId)}
    union all select 'customer',c.id,c.organization_id,b.id,c.id,null,null,c.name,'Client profile',o.name,b.name,c.mobile from customers c join organizations o on o.id=c.organization_id join lateral(select id,name from centres where organization_id=c.organization_id and active order by (id=c.centre_id) desc nulls last,created_at,id limit 1) b on true where c.organization_id in (${sql.join(
      orgs.map((x) => sql`${x}::uuid`),
      sql`, `,
    )})`;
    return query<HelpSource>(
      t,
      sql`select * from (${q}) s where (${f.kind ?? ""}='' or s.kind=${f.kind ?? ""}) and (${f.id ?? ""}='' or s.id::text=${f.id ?? ""}) and (${f.organizationId}='' or s."organizationId"::text=${f.organizationId}) and (${f.customerId ?? ""}='' or (s."customerId"::text=${f.customerId ?? ""} and s.kind<>'customer')) and (strpos(lower(s.client),lower(${f.q}))>0 or strpos(lower(s.name),lower(${f.q}))>0 or strpos(coalesce(s.mobile,''),${f.q})>0 or (${f.q.replace(/\D/g, "").length >= 3} and regexp_replace(coalesce(s.mobile,''),'[^0-9]','','g') like ${"%" + f.q.replace(/\D/g, "") + "%"})) order by s.client,s.id,s.kind limit 20 offset ${(f.page - 1) * 20}`,
    );
  }
  async function source(t: Database, a: Access, raw: unknown) {
    const f = sourceSchema.parse(raw),
      [s] = await sources(t, a, f);
    return s ?? fail(404, "Client, lead or project unavailable in your company");
  }
  async function resolvers(t: Database, org: string, centre: string) {
    void centre;
    return query<{ id: string; name: string }>(
      t,
      sql`select distinct u.id,u.name from employee_role_assignments e join employee_profiles p on p.user_id=e.user_id and p.active join "user" u on u.id=p.user_id and coalesce(u.banned,false)=false join centres c on c.id=e.centre_id and c.organization_id=e.organization_id and c.active where e.organization_id=${org}::uuid order by u.name,u.id`,
    );
  }
  async function policies(t: Database, org: string) {
    return t.select().from(helpConcernPolicies).where(eq(helpConcernPolicies.organizationId, org));
  }
  async function get(t: Database, a: Access, id: string) {
    const [ticket] = await t
      .select()
      .from(helpTickets)
      .where(and(eq(helpTickets.id, z.uuid().parse(id)), helpScope(a)));
    return ticket ?? fail(404, "Help ticket unavailable");
  }
  async function event(
    t: Database,
    a: Access,
    ticket: typeof helpTickets.$inferSelect,
    action: string,
    notes: string,
    before: typeof helpTickets.$inferSelect | null,
  ) {
    await t.insert(helpTicketEvents).values({
      organizationId: ticket.organizationId,
      ticketId: ticket.id,
      actorId: a.user.id,
      action,
      notes,
      before,
      after: ticket,
    });
    await t.insert(auditLogs).values({
      organizationId: ticket.organizationId,
      actorId: a.user.id,
      targetId: ticket.id,
      action: `help.${action}`,
      metadata: { version: ticket.version, status: ticket.status },
    });
  }
  async function claim(
    t: Database,
    a: Access,
    fileId: string | undefined,
    ticket: typeof helpTickets.$inferSelect,
    sourceRef?: { kind: string; id: string },
  ) {
    if (!fileId) return;
    const [f] = await t.select().from(helpTicketFiles).where(eq(helpTicketFiles.id, fileId));
    if (
      !f ||
      f.uploadedBy !== a.user.id ||
      f.organizationId !== ticket.organizationId ||
      f.centreId !== ticket.centreId ||
      !f.verifiedAt ||
      f.expiresAt < new Date() ||
      f.ticketId ||
      (sourceRef
        ? f.sourceKind !== sourceRef.kind || f.sourceId !== sourceRef.id
        : f.sourceKind !== "ticket" || f.sourceId !== ticket.id)
    )
      fail(409, "Attachment expired, already used or unavailable. Upload it again.");
    await t
      .update(helpTicketFiles)
      .set({ ticketId: ticket.id, updatedAt: new Date() })
      .where(eq(helpTicketFiles.id, fileId));
  }
  return {
    async directory(h: Headers, ref?: unknown) {
      const a = await access(h),
        branches = a.assignments;
      const orgs = [...new Set(branches.map((x) => x.organizationId))];
      const companies = orgs.length
        ? await query<{ id: string; name: string }>(
            db,
            sql`select id,name from organizations where id in (${sql.join(
              orgs.map((x) => sql`${x}::uuid`),
              sql`,`,
            )}) order by name`,
          )
        : [];
      const centres = branches.length
        ? await query<{ id: string; name: string; organizationId: string }>(
            db,
            sql`select id,name,organization_id as "organizationId" from centres where active and (${sql.join(
              branches.map((x) =>
                adminOrganizations(a).includes(x.organizationId)
                  ? sql`organization_id=${x.organizationId}::uuid`
                  : sql`(id=${x.centreId}::uuid and organization_id=${x.organizationId}::uuid)`,
              ),
              sql` or `,
            )}) order by name`,
          )
        : [];
      const selected = ref ? await source(db, a, ref) : null;
      const intakeOrg =
        selected?.organizationId ??
        eligibleAssignments(a, "help.raise").find((x) =>
          allowed(a, x.organizationId, x.centreId, "help.read"),
        )?.organizationId;
      return {
        currentUser: { id: a.user.id, name: a.user.name },
        filterResolvers: await query<{ id: string; name: string }>(
          db,
          sql`select distinct u.id,u.name from help_tickets join "user" u on u.id=help_tickets.assigned_to where ${helpScope(a)} order by u.name,u.id`,
        ),
        companies,
        centres,
        canRaise: Boolean(intakeOrg),
        adminOrganizations: adminOrganizations(a),
        selected,
        clients: intakeOrg
          ? await sources(db, a, { kind: "customer", organizationId: intakeOrg })
          : [],
        intakeOrganizationId: intakeOrg ?? "",
        resolvers: intakeOrg ? await resolvers(db, intakeOrg, "") : [],
        policies: intakeOrg ? await policies(db, intakeOrg) : [],
      };
    },
    async sources(h: Headers, raw: unknown) {
      return sources(db, await access(h), raw);
    },
    async context(h: Headers, raw: unknown) {
      const a = await access(h),
        s = await source(db, a, raw);
      return {
        source: s,
        related: await sources(db, a, { customerId: s.customerId }),
        resolvers: await resolvers(db, s.organizationId, s.centreId),
        policies: await policies(db, s.organizationId),
      };
    },
    async list(h: Headers, raw: unknown = {}) {
      const a = await access(h),
        f = filterSchema.parse(raw),
        conditions = [helpScope(a)];
      if (f.organizationId) conditions.push(eq(helpTickets.organizationId, f.organizationId));
      if (f.centreId) conditions.push(eq(helpTickets.centreId, f.centreId));
      if (f.resolver) conditions.push(eq(helpTickets.assignedTo, f.resolver));
      if (f.status) conditions.push(eq(helpTickets.status, f.status));
      if (f.priority) conditions.push(eq(helpTickets.priority, f.priority));
      if (f.tab === "raised") conditions.push(eq(helpTickets.createdBy, a.user.id));
      if (f.tab === "assigned") conditions.push(eq(helpTickets.assignedTo, a.user.id));
      if (f.tab === "confirmation")
        conditions.push(
          and(
            eq(helpTickets.status, "awaiting_confirmation"),
            or(
              eq(helpTickets.createdBy, a.user.id),
              sql`${helpTickets.createdBy}=${helpTickets.assignedTo} and ${helpTickets.resolvedBy}<>${a.user.id} and ${helpTickets.organizationId} in (${
                adminOrganizations(a).length
                  ? sql.join(
                      adminOrganizations(a).map((x) => sql`${x}::uuid`),
                      sql`, `,
                    )
                  : sql`null::uuid`
              })`,
            ),
          )!,
        );
      if (f.tab === "reopened") conditions.push(eq(helpTickets.status, "reopened"));
      if (f.tab === "overdue")
        conditions.push(sql`${helpTickets.dueAt}<now() and ${helpTickets.status}<>'closed'`);
      if (f.from)
        conditions.push(sql`${helpTickets.createdAt}>=${f.from + "T00:00:00+05:30"}::timestamptz`);
      if (f.to)
        conditions.push(
          sql`${helpTickets.createdAt}<${f.to + "T00:00:00+05:30"}::timestamptz+interval '1 day'`,
        );
      if (f.q)
        conditions.push(
          sql`(c.name ilike ${`%${f.q.replace(/[\\%_]/g, "\\$&")}%`} or help_tickets.number ilike ${`%${f.q.replace(/[\\%_]/g, "\\$&")}%`} or help_tickets.details ilike ${`%${f.q.replace(/[\\%_]/g, "\\$&")}%`})`,
        );
      const from = sql`from help_tickets join customers c on c.id=help_tickets.customer_id and c.organization_id=help_tickets.organization_id join organizations o on o.id=help_tickets.organization_id join centres b on b.id=help_tickets.centre_id join "user" u on u.id=help_tickets.assigned_to join "user" creator on creator.id=help_tickets.created_by where ${and(...conditions)}`;
      const [count] = await query<{
        total: string;
        open: string;
        confirmation: string;
        overdue: string;
      }>(
        db,
        sql`select count(*)::text as total,count(*) filter(where status<>'closed')::text as open,count(*) filter(where status='awaiting_confirmation')::text as confirmation,count(*) filter(where due_at<now() and status<>'closed')::text as overdue ${from}`,
      );
      const rows = await query<{
        id: string;
        number: string;
        client: string;
        company: string;
        location: string;
        resolver: string;
        creator: string;
        priority: string;
        status: string;
        concern: string;
        created_at: string;
        due_at: string | null;
      }>(
        db,
        sql`select help_tickets.id,number,c.name as client,o.name as company,coalesce(help_tickets.location,b.name) as location,u.name as resolver,creator.name as creator,priority,status,concern,help_tickets.created_at,help_tickets.due_at ${from} order by help_tickets.created_at desc,help_tickets.id limit 20 offset ${(f.page - 1) * 20}`,
      );
      return {
        rows,
        total: Number(count.total),
        open: Number(count.open),
        confirmation: Number(count.confirmation),
        overdue: Number(count.overdue),
        page: f.page,
        pageSize: 20,
      };
    },
    async intake(h: Headers, organizationId: string) {
      const a = await access(h),
        org = z.uuid().parse(organizationId);
      if (!allowed(a, org, "", "help.raise") || !allowed(a, org, "", "help.read"))
        fail(403, "Help intake is unavailable for this company");
      return {
        employees: await resolvers(db, org, ""),
        policies: await policies(db, org),
        clients: await sources(db, a, { kind: "customer", organizationId: org }),
      };
    },
    async create(h: Headers, raw: unknown) {
      const i = createSchema.parse(raw);
      return transaction(h, async (t, a) => {
        const s = await source(t, a, i);
        const [existing] = await t
          .select()
          .from(helpTickets)
          .where(eq(helpTickets.requestId, i.requestId));
        if (existing) {
          if (existing.createdBy !== a.user.id) fail(409, "Request already used");
          await get(t, a, existing.id);
          return existing;
        }
        if (!(await resolvers(t, s.organizationId, s.centreId)).some((x) => x.id === i.assignedTo))
          fail(400, "Select an active resolver in this company and location");
        const ps = await policies(t, s.organizationId),
          p = ps.find((x) => x.code === i.concern);
        if (!p?.active) fail(400, "Select an active concern type");
        if (p.attachmentRequired && !i.fileId)
          fail(400, "Supporting attachment is required for this concern");
        const [ticket] = await t
          .insert(helpTickets)
          .values({
            id: randomUUID(),
            number: `HT-${new Date().getUTCFullYear()}-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
            organizationId: s.organizationId,
            centreId: s.centreId,
            customerId: s.customerId,
            leadId: s.leadId,
            projectId: s.projectId,
            createdBy: a.user.id,
            location: i.location ?? s.location,
            assignedTo: i.assignedTo,
            concern: p.name,
            details: i.details,
            priority: i.priority,
            requestId: i.requestId,
            attachmentRequired: p.attachmentRequired,
            dueAt: p.slaHours ? new Date(Date.now() + p.slaHours * 3600000) : null,
          })
          .returning();
        await claim(t, a, i.fileId, ticket, i);
        await event(t, a, ticket, "raised", i.details, null);
        return ticket;
      });
    },
    async detail(h: Headers, id: string) {
      const a = await access(h),
        ticket = await get(db, a, id);
      const [info] = await query<{
        client: string;
        company: string;
        location: string;
        creator: string;
        resolver: string;
        project: string | null;
      }>(
        db,
        sql`select c.name as client,o.name as company,coalesce(t.location,b.name) as location,cr.name as creator,re.name as resolver,p.name as project from help_tickets t join customers c on c.id=t.customer_id join organizations o on o.id=t.organization_id join centres b on b.id=t.centre_id join "user" cr on cr.id=t.created_by join "user" re on re.id=t.assigned_to left join projects p on p.id=t.project_id where t.id=${id}::uuid`,
      );
      const events = await query<{
        id: string;
        action: string;
        notes: string;
        actor: string;
        createdAt: string;
      }>(
        db,
        sql`select e.id,e.action,e.notes,u.name as actor,e.created_at as "createdAt" from help_ticket_events e join "user" u on u.id=e.actor_id where e.ticket_id=${id}::uuid and e.organization_id=${ticket.organizationId}::uuid order by e.created_at,e.id`,
      );
      const files = await db
        .select({
          id: helpTicketFiles.id,
          name: helpTicketFiles.name,
          createdAt: helpTicketFiles.createdAt,
        })
        .from(helpTicketFiles)
        .where(eq(helpTicketFiles.ticketId, id));
      const admin = adminOrganizations(a).includes(ticket.organizationId),
        creator = ticket.createdBy === a.user.id,
        resolver = isResolver(a, ticket);
      const self = ticket.createdBy === ticket.assignedTo;
      const canConfirm =
        (admin || creator) &&
        (!self || (admin && ticket.resolvedBy !== a.user.id)) &&
        ticket.resolvedBy !== a.user.id;
      return {
        ticket,
        info,
        events,
        files,
        currentUserId: a.user.id,
        admin,
        canResolve: resolver,
        canConfirm,
        canReopen: creator || admin,
        resolvers: admin ? await resolvers(db, ticket.organizationId, ticket.centreId) : [],
        canViewLead: ticket.leadId
          ? (
              await db
                .select({ id: leads.id })
                .from(leads)
                .where(and(eq(leads.id, ticket.leadId), leadScope(a)))
            ).length > 0
          : false,
        canViewProject: ticket.projectId
          ? (
              await db
                .select({ id: projects.id })
                .from(projects)
                .where(and(eq(projects.id, ticket.projectId), projectVisibility(db, a)))
            ).length > 0
          : false,
      };
    },
    async change(h: Headers, id: string, raw: unknown) {
      const i = actionSchema.parse(raw);
      return transaction(h, async (t, a) => {
        const before = await get(t, a, id),
          admin = adminOrganizations(a).includes(before.organizationId),
          creator = before.createdBy === a.user.id,
          resolver = isResolver(a, before);
        if (i.version !== before.version) fail(409, "Ticket changed. Refresh before trying again.");
        const patch: Partial<typeof helpTickets.$inferInsert> = {
          version: before.version + 1,
          updatedAt: new Date(),
        };
        if (i.action === "start") {
          if (!resolver) fail(403, "Only the assigned resolver can start work");
          if (!["raised", "reopened"].includes(before.status))
            fail(409, "Ticket cannot be started in this state");
          patch.status = "in_progress";
        }
        if (i.action === "resolve") {
          if (!resolver) fail(403, "Only the assigned resolver can submit a solution");
          if (!["raised", "in_progress", "reopened"].includes(before.status))
            fail(409, "Ticket is already awaiting confirmation or closed");
          Object.assign(patch, {
            status: "awaiting_confirmation",
            resolvedBy: a.user.id,
            resolvedAt: new Date(),
          });
        }
        if (i.action === "close") {
          if (
            !(creator || admin) ||
            before.resolvedBy === a.user.id ||
            (before.createdBy === before.assignedTo && !admin)
          )
            fail(
              403,
              "Confirmation requires the creator or a separate Admin; self-assigned tickets require a separate Admin",
            );
          if (before.status !== "awaiting_confirmation")
            fail(409, "A resolver must submit a solution before confirmation");
          Object.assign(patch, { status: "closed", closedBy: a.user.id, closedAt: new Date() });
        }
        if (i.action === "reopen") {
          if (!creator && !admin) fail(403, "Only the creator or Admin can reopen");
          if (!["closed", "awaiting_confirmation"].includes(before.status))
            fail(409, "Only resolved or closed tickets can be reopened");
          Object.assign(patch, {
            status: "reopened",
            resolvedBy: null,
            resolvedAt: null,
            closedBy: null,
            closedAt: null,
          });
        }
        if (i.action === "reassign") {
          if (!admin) fail(403, "Only Admin can reassign");
          if (before.status === "closed") fail(409, "Reopen the ticket before reassignment");
          if (
            !i.assignedTo ||
            i.assignedTo === before.assignedTo ||
            !(await resolvers(t, before.organizationId, before.centreId)).some(
              (x) => x.id === i.assignedTo,
            )
          )
            fail(400, "Select a different active resolver in this company/location");
          Object.assign(patch, {
            assignedTo: i.assignedTo,
            status: "raised",
            resolvedBy: null,
            resolvedAt: null,
          });
        }
        if (i.fileId && i.action !== "resolve")
          fail(400, "Proof attachments are supported with a resolution");
        const [after] = await t
          .update(helpTickets)
          .set(patch)
          .where(eq(helpTickets.id, id))
          .returning();
        await claim(t, a, i.fileId, after);
        await event(t, a, after, i.action, i.notes, before);
        return after;
      });
    },
    async policies(h: Headers, org: string) {
      const a = await access(h);
      if (!adminOrganizations(a).includes(z.uuid().parse(org))) fail(403, "Admin access required");
      return policies(db, org);
    },
    async savePolicy(h: Headers, raw: unknown) {
      const i = policySchema.parse(raw);
      return transaction(h, async (t, a) => {
        if (!adminOrganizations(a).includes(i.organizationId)) fail(403, "Admin access required");
        const [old] = await t
          .select()
          .from(helpConcernPolicies)
          .where(
            and(
              eq(helpConcernPolicies.organizationId, i.organizationId),
              eq(helpConcernPolicies.code, i.code),
            ),
          );
        if ((old?.version ?? 0) !== i.version)
          fail(409, "Concern settings changed. Refresh first.");
        const values = {
          name: i.name,
          active: i.active,
          attachmentRequired: i.attachmentRequired,
          slaHours: i.slaHours,
          version: i.version + 1,
          updatedAt: new Date(),
        };
        const [saved] = old
          ? await t
              .update(helpConcernPolicies)
              .set(values)
              .where(eq(helpConcernPolicies.id, old.id))
              .returning()
          : await t
              .insert(helpConcernPolicies)
              .values({ ...values, organizationId: i.organizationId, code: i.code })
              .returning();
        await t.insert(auditLogs).values({
          organizationId: i.organizationId,
          actorId: a.user.id,
          targetId: saved.id,
          action: "help.concern_policy",
          metadata: { before: old ?? null, after: saved, reason: i.notes },
        });
        return saved;
      });
    },
    async prepareFile(h: Headers, raw: unknown) {
      const i = fileSchema.parse(raw);
      return transaction(h, async (t, a) => {
        if (!store) fail(503, "Private help-ticket storage is unavailable");
        let org: string, centre: string, kind: string, sourceId: string;
        if (i.source) {
          const s = await source(t, a, i.source);
          org = s.organizationId;
          centre = s.centreId;
          kind = s.kind;
          sourceId = s.id;
        } else {
          const ticket = await get(t, a, i.ticketId!);
          if (
            !isResolver(a, ticket) ||
            !["raised", "in_progress", "reopened"].includes(ticket.status)
          )
            fail(403, "Only the current resolver can upload resolution proof");
          org = ticket.organizationId;
          centre = ticket.centreId;
          kind = "ticket";
          sourceId = ticket.id;
        }
        const [recent] = await query<{ n: string }>(
          t,
          sql`select count(*)::text as n from help_ticket_files where uploaded_by=${a.user.id} and created_at>now()-interval '1 hour'`,
        );
        if (Number(recent.n) >= 30) fail(429, "Upload limit reached. Try later.");
        const id = randomUUID(),
          path = `${org}/${id}`;
        const signed = await store!.prepare(path);
        await t.insert(helpTicketFiles).values({
          id,
          organizationId: org,
          centreId: centre,
          sourceKind: kind,
          sourceId,
          uploadedBy: a.user.id,
          name: i.name,
          contentType: i.contentType,
          size: i.size,
          objectPath: path,
          expiresAt: new Date(Date.now() + 30 * 60000),
        });
        return { id, signedUrl: signed.signedUrl };
      });
    },
    async finalizeFile(h: Headers, id: string) {
      return transaction(h, async (t, a) => {
        const [f] = await t
          .select()
          .from(helpTicketFiles)
          .where(eq(helpTicketFiles.id, z.uuid().parse(id)));
        if (
          !f ||
          f.uploadedBy !== a.user.id ||
          f.ticketId ||
          f.expiresAt < new Date() ||
          !a.assignments.some((x) => x.organizationId === f.organizationId)
        )
          fail(404, "Upload unavailable or expired");
        if (f.sourceKind === "ticket") {
          const ticket = await get(t, a, f.sourceId);
          if (!isResolver(a, ticket)) fail(403, "Resolver assignment changed");
        } else await source(t, a, { kind: f.sourceKind, id: f.sourceId });
        if (!store) fail(503, "Private help-ticket storage unavailable");
        const bytes = await store!.read(f.objectPath);
        if (!validFile(bytes, f.contentType, f.size))
          fail(400, "File size or signature does not match. Upload a valid PDF, JPEG or PNG.");
        await t
          .update(helpTicketFiles)
          .set({ verifiedAt: new Date(), updatedAt: new Date() })
          .where(eq(helpTicketFiles.id, id));
        return { id, verified: true };
      });
    },
    async download(h: Headers, id: string) {
      return transaction(h, async (t, a) => {
        const [f] = await t
          .select()
          .from(helpTicketFiles)
          .where(eq(helpTicketFiles.id, z.uuid().parse(id)));
        if (!f?.ticketId || !f.verifiedAt) fail(404, "Attachment unavailable");
        await get(t, a, f.ticketId);
        if (!store) fail(503, "Private help-ticket storage unavailable");
        const url = await store!.sign(f.objectPath);
        await t.insert(auditLogs).values({
          organizationId: f.organizationId,
          actorId: a.user.id,
          targetId: f.id,
          action: "help.attachment_download",
          metadata: { ticketId: f.ticketId },
        });
        return { url };
      });
    },
  };
}
