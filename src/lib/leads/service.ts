import { newBusinessAllowed } from "../management/policies";
import { adminCatalog } from "../db/schema";
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { alias } from "drizzle-orm/pg-core";
import type { Database } from "../db";
import {
  auditLogs,
  centres,
  customers,
  employeeProfiles,
  employeeRoleAssignments,
  leadActivities,
  leadFollowUps,
  leads,
  orders,
  organizations,
  projects,
  rolePermissions,
  user,
  workflowEvents,
} from "../db/schema";
import { AccessError, resolveAccess, type Access } from "../auth/access";
import { buildAuth, type AuthSettings } from "../auth/config";
import {
  activitySchema,
  customerSchema,
  followUpSchema,
  leadFiltersSchema,
  leadFormSchema,
  projectSchema,
  updateLeadSchema,
  type LeadFilters,
  type LeadInput,
} from "./validation";
import {
  canCoordinate,
  customerScope,
  eligibleAssignments,
  leadScope,
  organizationAllowed,
  projectScope,
} from "./access";
import { preSalesStages } from "../domain/workflows";

export class DuplicateLeadError extends AccessError {
  constructor(
    public candidates: { id: string; clientName: string | null; stage: number }[],
    public restricted: boolean,
  ) {
    super(
      409,
      "Possible duplicate contact. Review the matches and acknowledge why a separate lead is needed.",
    );
  }
}
const pattern = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;
const money = (value: string) => value || null;
const cseUser = alias(user, "lead_cse");
const selection = {
  ...getTableColumns(leads),
  clientName: sql<string>`coalesce(${leads.clientName}, ${customers.name})`.as(
    "display_client_name",
  ),
  mobile: sql<string>`coalesce(${leads.mobile}, ${customers.mobile}, '')`.as("display_mobile"),
  projectName: projects.name,
  assignedName: user.name,
  companyName: organizations.name,
  cseName: cseUser.name,
};

export function leadService(db: Database, settings: AuthSettings) {
  const auth = buildAuth(db, settings);
  const accessFor = async (headers: Headers) => {
    const access = await resolveAccess(db, auth, headers);
    if (!eligibleAssignments(access, "leads.read").length) throw new AccessError(403);
    return access;
  };
  async function mutation<T>(headers: Headers, work: (tx: Database, access: Access) => Promise<T>) {
    return db.transaction(async (transaction) => {
      const tx = transaction as unknown as Database;
      // Coordinate employee/permission mutations, assignment changes and duplicate checks.
      await tx.execute(sql`select pg_advisory_xact_lock(73190021)`);
      const access = await resolveAccess(tx, buildAuth(tx, settings), headers);
      if (!eligibleAssignments(access, "leads.read").length) throw new AccessError(403);
      return work(tx, access);
    });
  }
  function base(tx: Database) {
    return tx
      .select(selection)
      .from(leads)
      .innerJoin(
        customers,
        and(eq(customers.id, leads.customerId), eq(customers.organizationId, leads.organizationId)),
      )
      .leftJoin(
        projects,
        and(eq(projects.id, leads.projectId), eq(projects.organizationId, leads.organizationId)),
      )
      .leftJoin(user, eq(user.id, leads.assignedTo))
      .leftJoin(cseUser, eq(cseUser.id, leads.cseId))
      .innerJoin(organizations, eq(organizations.id, leads.organizationId));
  }
  function predicate(access: Access, filters: LeadFilters) {
    const q = filters.q;
    return and(
      leadScope(access),
      filters.customerId ? eq(leads.customerId, filters.customerId) : undefined,
      filters.projectId ? eq(leads.projectId, filters.projectId) : undefined,
      filters.archived === "yes" ? isNotNull(leads.archivedAt) : isNull(leads.archivedAt),
      filters.organizationId ? eq(leads.organizationId, filters.organizationId) : undefined,
      filters.centreId ? eq(leads.centreId, filters.centreId) : undefined,
      filters.assignedTo ? eq(leads.assignedTo, filters.assignedTo) : undefined,
      filters.stage ? eq(leads.stage, Number(filters.stage)) : undefined,
      filters.outcome
        ? filters.outcome === "open"
          ? isNull(leads.outcome)
          : eq(leads.outcome, filters.outcome)
        : undefined,
      filters.priority ? eq(leads.priority, filters.priority) : undefined,
      filters.source ? ilike(leads.source, pattern(filters.source)) : undefined,
      filters.territory ? ilike(leads.territory, pattern(filters.territory)) : undefined,
      filters.financialYear ? eq(leads.financialYear, filters.financialYear) : undefined,
      filters.bookingMonth ? eq(leads.bookingMonth, Number(filters.bookingMonth)) : undefined,
      q
        ? or(
            ilike(sql`coalesce(${leads.clientName},${customers.name})`, pattern(q)),
            ilike(
              sql`coalesce(${leads.mobile},${customers.mobile},'')`,
              pattern(q.replace(/[ ()-]/g, "")),
            ),
            ilike(leads.siteAddress, pattern(q)),
            ilike(projects.name, pattern(q)),
          )
        : undefined,
      filters.followUp === "overdue"
        ? and(sql`${leads.nextFollowUp} < now()`, isNull(leads.outcome))
        : filters.followUp === "today"
          ? and(
              sql`${leads.nextFollowUp} >= (date_trunc('day',now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')`,
              sql`${leads.nextFollowUp} < ((date_trunc('day',now() at time zone 'Asia/Kolkata') + interval '1 day') at time zone 'Asia/Kolkata')`,
            )
          : filters.followUp === "upcoming"
            ? sql`${leads.nextFollowUp} >= ((date_trunc('day',now() at time zone 'Asia/Kolkata') + interval '1 day') at time zone 'Asia/Kolkata')`
            : filters.followUp === "none"
              ? isNull(leads.nextFollowUp)
              : undefined,
    );
  }
  async function read(tx: Database, access: Access, id: string, write = false) {
    const query = base(tx).where(
      and(eq(leads.id, id), leadScope(access, write ? "leads.write" : "leads.read")),
    );
    const [lead] = await query;
    if (!lead) throw new AccessError(404, "Lead unavailable");
    if (write && lead.archivedAt) throw new AccessError(409, "Restore this lead before editing it");
    return lead;
  }
  async function versioned(tx: Database, access: Access, id: string, version: number) {
    const lead = await read(tx, access, id, true);
    if (lead.version !== version)
      throw new AccessError(409, "This lead changed since you opened it. Refresh before saving.");
    return lead;
  }
  async function activity(
    tx: Database,
    access: Access,
    lead: { id: string; organizationId: string },
    kind: string,
    summary: string,
    changes: Record<string, { before: unknown; after: unknown }> = {},
  ) {
    await tx.insert(leadActivities).values({
      organizationId: lead.organizationId,
      leadId: lead.id,
      actorId: access.user.id,
      kind,
      summary,
      changes,
    });
    await tx.insert(auditLogs).values({
      organizationId: lead.organizationId,
      actorId: access.user.id,
      targetId: lead.id,
      action: `lead.${kind}`,
      metadata: { fields: Object.keys(changes) },
    });
  }
  async function validateAssignment(
    tx: Database,
    access: Access,
    organizationId: string,
    centreId: string,
    assignedTo: string,
    cseId = "",
  ) {
    organizationAllowed(access, organizationId, "leads.write");
    const allowed = eligibleAssignments(access, "leads.write").some(
      (a) =>
        a.organizationId === organizationId &&
        (["Admin", "Super Admin"].includes(a.role) || a.centreId === centreId),
    );
    if (
      !allowed ||
      (!canCoordinate(access, organizationId, centreId) && assignedTo !== access.user.id)
    )
      throw new AccessError(403, "You cannot assign work to this employee or branch");
    const [branch] = await tx
      .select()
      .from(centres)
      .where(
        and(
          eq(centres.id, centreId),
          eq(centres.organizationId, organizationId),
          eq(centres.active, true),
        ),
      );
    if (!branch) throw new AccessError(400, "Select an active branch in the company");
    const candidates = await tx
      .select({ id: user.id, role: employeeRoleAssignments.role })
      .from(employeeRoleAssignments)
      .innerJoin(employeeProfiles, eq(employeeProfiles.userId, employeeRoleAssignments.userId))
      .innerJoin(user, eq(user.id, employeeRoleAssignments.userId))
      .where(
        and(
          eq(employeeRoleAssignments.organizationId, organizationId),
          eq(employeeRoleAssignments.centreId, centreId),
          eq(employeeProfiles.active, true),
          or(eq(user.banned, false), isNull(user.banned)),
        ),
      );
    const grants = await tx
      .select()
      .from(rolePermissions)
      .where(eq(rolePermissions.organizationId, organizationId));
    const has = (id: string, p: string) =>
      candidates.some(
        (a) =>
          a.id === id &&
          (["Admin", "Super Admin"].includes(a.role) ||
            grants.some((g) => g.role === a.role && g.permission === p)),
      );
    if (!has(assignedTo, "leads.read") || !has(assignedTo, "leads.write"))
      throw new AccessError(400, "Choose an active employee with lead access in this branch");
    if (cseId && !candidates.some((a) => a.id === cseId && a.role === "CSE"))
      throw new AccessError(400, "Choose an active CSE assigned to this branch");
  }
  async function duplicates(tx: Database, access: Access, data: LeadInput, exclude?: string) {
    const mobileMatch = sql`regexp_replace(coalesce(${leads.mobile},${customers.mobile},''),'[^0-9]','','g') in (${data.mobile.replace(/\D/g, "")},${data.mobile.slice(3)})`;
    const matches = await tx
      .select({
        id: leads.id,
        clientName: leads.clientName,
        stage: leads.stage,
        organizationId: leads.organizationId,
        centreId: leads.centreId,
        assignedTo: leads.assignedTo,
      })
      .from(leads)
      .innerJoin(customers, eq(customers.id, leads.customerId))
      .where(
        and(
          eq(leads.organizationId, data.organizationId),
          isNull(leads.archivedAt),
          exclude ? ne(leads.id, exclude) : undefined,
          or(
            mobileMatch,
            and(
              sql`lower(btrim(coalesce(${leads.clientName},${customers.name}))) = lower(btrim(${data.clientName}))`,
              sql`lower(btrim(${leads.siteAddress})) = lower(btrim(${data.siteAddress}))`,
            ),
          ),
        ),
      )
      .limit(21);
    const visible = matches.filter((m) =>
      eligibleAssignments(access, "leads.read").some(
        (a) =>
          a.organizationId === m.organizationId &&
          (["Admin", "Super Admin"].includes(a.role) ||
            (a.centreId === m.centreId &&
              (["CSE", "Sales Manager"].includes(a.role) || m.assignedTo === access.user.id))),
      ),
    );
    return {
      candidates: visible
        .slice(0, 20)
        .map((m) => ({ id: m.id, clientName: m.clientName, stage: m.stage })),
      restricted: matches.length > visible.length,
    };
  }
  async function syncFollowUp(
    tx: Database,
    id: string,
    organizationId: string,
    unscheduledAction: string | null = null,
  ) {
    const [next] = await tx
      .select()
      .from(leadFollowUps)
      .where(
        and(
          eq(leadFollowUps.leadId, id),
          eq(leadFollowUps.organizationId, organizationId),
          eq(leadFollowUps.state, "pending"),
        ),
      )
      .orderBy(asc(leadFollowUps.dueAt), asc(leadFollowUps.id))
      .limit(1);
    await tx
      .update(leads)
      .set({ nextFollowUp: next?.dueAt ?? null, nextAction: next?.action ?? unscheduledAction })
      .where(and(eq(leads.id, id), eq(leads.organizationId, organizationId)));
  }
  function values(data: LeadInput) {
    return {
      clientName: data.clientName,
      mobile: data.mobile,
      centreId: data.centreId,
      assignedTo: data.assignedTo,
      bookingMonth: data.bookingMonth ? Number(data.bookingMonth) : null,
      financialYear: data.financialYear || null,
      brand: data.brand || null,
      cseId: data.cseId || null,
      siteAddress: data.siteAddress,
      territory: data.territory || null,
      soe: data.soe || null,
      customerType: data.customerType || null,
      buildingType: data.buildingType || null,
      orderType: data.orderType || null,
      finalisedValue: money(data.finalisedValue),
      orderQty: money(data.orderQty),
      pleatedMeshQty: money(data.pleatedMeshQty),
      material: data.material || null,
      discountOffered: data.discountOffered || null,
      source: data.source || null,
      priority: data.priority,
      expectedValue: money(data.expectedValue),
      nextFollowUp: data.nextFollowUp ? new Date(data.nextFollowUp) : null,
      nextAction: data.nextAction || null,
      remarks: data.remarks || null,
      stage: data.stage,
      outcome: data.outcome === "open" ? null : data.outcome,
      lossReason: data.outcome === "lost" ? data.lossReason : null,
      updatedAt: new Date(),
    };
  }
  async function closeWorkflow(
    tx: Database,
    access: Access,
    lead: typeof leads.$inferSelect,
    previousStage: number | null,
  ) {
    await tx.insert(workflowEvents).values({
      organizationId: lead.organizationId,
      leadId: lead.id,
      actorId: access.user.id,
      fromStage: previousStage,
      toStage: lead.stage,
      notes: lead.lossReason ?? lead.outcome,
    });
    if (lead.outcome === "won") {
      throw new AccessError(400, "Use quotation-backed order conversion to mark Won");
    }
    if (lead.outcome) {
      await tx
        .update(leadFollowUps)
        .set({ state: "cancelled", completedAt: new Date(), completionNotes: "Lead closed" })
        .where(
          and(
            eq(leadFollowUps.leadId, lead.id),
            eq(leadFollowUps.organizationId, lead.organizationId),
            eq(leadFollowUps.state, "pending"),
          ),
        );
      await syncFollowUp(tx, lead.id, lead.organizationId);
    }
  }
  return {
    async list(headers: Headers, raw: unknown = {}) {
      const filters = leadFiltersSchema.parse(raw),
        access = await accessFor(headers),
        where = predicate(access, filters);
      const rows = await base(db)
        .where(where)
        .orderBy(desc(leads.createdAt), desc(leads.id))
        .limit(filters.pageSize)
        .offset((filters.page - 1) * filters.pageSize);
      const [totals] = await db
        .select({ total: count() })
        .from(leads)
        .innerJoin(customers, eq(customers.id, leads.customerId))
        .leftJoin(projects, eq(projects.id, leads.projectId))
        .where(where);
      return { rows, total: totals.total, page: filters.page, pageSize: filters.pageSize };
    },
    async board(headers: Headers, raw: unknown = {}) {
      const filters = leadFiltersSchema.parse(raw),
        access = await accessFor(headers),
        where = predicate(access, filters);
      // Seven bounded SQL queries: each stage has its own server-side page, never
      // a misleading board made by slicing one globally paginated list.
      const buckets = [];
      for (let stage = 1; stage <= 7; stage++) {
        const stageWhere = and(where, eq(leads.stage, stage));
        const rows = await base(db)
          .where(stageWhere)
          .orderBy(desc(leads.createdAt), desc(leads.id))
          .limit(10);
        const [n] = await db
          .select({ total: count() })
          .from(leads)
          .innerJoin(customers, eq(customers.id, leads.customerId))
          .leftJoin(projects, eq(projects.id, leads.projectId))
          .where(stageWhere);
        buckets.push({ stage, rows, total: n.total, page: 1 });
      }
      return buckets;
    },
    async summary(headers: Headers, raw: unknown = {}) {
      const filters = leadFiltersSchema.parse(raw),
        access = await accessFor(headers);
      const [result] = await db
        .select({
          total: count(),
          open: sql<number>`count(*) filter (where ${leads.outcome} is null)`.mapWith(Number),
          won: sql<number>`count(*) filter (where ${leads.outcome} = 'won')`.mapWith(Number),
          lost: sql<number>`count(*) filter (where ${leads.outcome} = 'lost')`.mapWith(Number),
          overdue:
            sql<number>`count(*) filter (where ${leads.outcome} is null and ${leads.nextFollowUp}<now())`.mapWith(
              Number,
            ),
          pipelineValue: sql<string>`coalesce(sum(${leads.expectedValue}) filter (where ${leads.outcome} is null),0)::text`,
        })
        .from(leads)
        .innerJoin(customers, eq(customers.id, leads.customerId))
        .leftJoin(projects, eq(projects.id, leads.projectId))
        .where(predicate(access, filters));
      return result;
    },
    async detail(headers: Headers, id: string, page = 1, followUpPage = 1) {
      const access = await accessFor(headers),
        lead = await read(db, access, z.uuid().parse(id));
      const activities = await db
        .select({ ...getTableColumns(leadActivities), actorName: user.name })
        .from(leadActivities)
        .innerJoin(user, eq(user.id, leadActivities.actorId))
        .where(
          and(
            eq(leadActivities.leadId, id),
            eq(leadActivities.organizationId, lead.organizationId),
          ),
        )
        .orderBy(desc(leadActivities.createdAt), desc(leadActivities.id))
        .limit(25)
        .offset((Math.max(1, Math.min(page, 100000)) - 1) * 25);
      const [activityTotal] = await db
        .select({ total: count() })
        .from(leadActivities)
        .where(
          and(
            eq(leadActivities.leadId, id),
            eq(leadActivities.organizationId, lead.organizationId),
          ),
        );
      const followUps = await db
        .select()
        .from(leadFollowUps)
        .where(
          and(eq(leadFollowUps.leadId, id), eq(leadFollowUps.organizationId, lead.organizationId)),
        )
        .orderBy(
          sql`case when ${leadFollowUps.state}='pending' then 0 else 1 end`,
          asc(leadFollowUps.dueAt),
          asc(leadFollowUps.id),
        )
        .limit(20)
        .offset((followUpPage - 1) * 20);
      const [followUpTotal] = await db
        .select({ total: count() })
        .from(leadFollowUps)
        .where(
          and(eq(leadFollowUps.leadId, id), eq(leadFollowUps.organizationId, lead.organizationId)),
        );
      const [order] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.leadId, id), eq(orders.organizationId, lead.organizationId)));
      return {
        lead,
        activities,
        activityTotal: activityTotal.total,
        followUps,
        followUpTotal: followUpTotal.total,
        followUpPage,
        orderId: order?.id ?? null,
        canEdit:
          !lead.archivedAt &&
          eligibleAssignments(access, "leads.write").some(
            (a) =>
              a.organizationId === lead.organizationId &&
              (["Admin", "Super Admin"].includes(a.role) ||
                (a.centreId === lead.centreId &&
                  (["CSE", "Sales Manager"].includes(a.role) ||
                    lead.assignedTo === access.user.id))),
          ),
        canAssign: canCoordinate(access, lead.organizationId, lead.centreId),
        canArchive: canCoordinate(access, lead.organizationId, lead.centreId),
      };
    },
    async create(headers: Headers, raw: unknown) {
      const data = leadFormSchema.parse(raw);
      if (data.stage !== 1 || data.outcome !== "open")
        throw new AccessError(400, "New leads start at Lead Generated");
      return mutation(headers, async (tx, access) => {
        await validateAssignment(
          tx,
          access,
          data.organizationId,
          data.centreId,
          data.assignedTo,
          data.cseId,
        );
        await newBusinessAllowed(tx, data.organizationId, data.territory);
        const matches = await duplicates(tx, access, data);
        if ((matches.candidates.length || matches.restricted) && !data.duplicateAcknowledged)
          throw new DuplicateLeadError(matches.candidates, matches.restricted);
        if (matches.restricted && !canCoordinate(access, data.organizationId, data.centreId))
          throw new AccessError(
            409,
            "A matching contact requires review by a branch coordinator before a separate lead can be created",
          );
        let customerId = data.customerId;
        if (customerId) {
          const [customer] = await tx
            .select()
            .from(customers)
            .where(
              and(
                eq(customers.id, customerId),
                eq(customers.organizationId, data.organizationId),
                customerScope(tx, access),
              ),
            );
          if (!customer) throw new AccessError(404, "Customer unavailable");
        } else {
          const [customer] = await tx
            .insert(customers)
            .values({
              organizationId: data.organizationId,
              name: data.clientName,
              mobile: data.mobile,
              assignedTo: data.assignedTo,
              centreId: data.centreId,
            })
            .returning();
          customerId = customer.id;
          await tx.insert(auditLogs).values({
            organizationId: data.organizationId,
            actorId: access.user.id,
            targetId: customer.id,
            action: "customer.created",
          });
        }
        let projectId = data.projectId;
        if (projectId) {
          const [project] = await tx
            .select()
            .from(projects)
            .where(
              and(
                eq(projects.id, projectId),
                eq(projects.organizationId, data.organizationId),
                eq(projects.customerId, customerId),
                projectScope(tx, access),
              ),
            );
          if (!project) throw new AccessError(404, "Project unavailable");
        } else {
          const [project] = await tx
            .insert(projects)
            .values({
              organizationId: data.organizationId,
              customerId,
              name: data.projectName,
              siteAddress: data.siteAddress,
              centreId: data.centreId,
              assignedTo: data.assignedTo,
            })
            .returning();
          projectId = project.id;
          await tx.insert(auditLogs).values({
            organizationId: data.organizationId,
            actorId: access.user.id,
            targetId: project.id,
            action: "project.created",
          });
        }
        const [lead] = await tx
          .insert(leads)
          .values({ organizationId: data.organizationId, customerId, projectId, ...values(data) })
          .returning();
        await activity(
          tx,
          access,
          lead,
          "created",
          `Lead generated${data.duplicateAcknowledged ? `; duplicate reviewed: ${data.duplicateReason}` : ""}`,
          Object.fromEntries(
            Object.entries({ ...values(data), customerId, projectId })
              .filter(([key]) => key !== "updatedAt")
              .map(([key, value]) => [
                key,
                { before: null, after: value instanceof Date ? value.toISOString() : value },
              ]),
          ),
        );
        await closeWorkflow(tx, access, lead, null);
        if (data.nextFollowUp)
          await tx.insert(leadFollowUps).values({
            organizationId: lead.organizationId,
            leadId: lead.id,
            assignedTo: data.assignedTo,
            dueAt: new Date(data.nextFollowUp),
            action: data.nextAction,
            createdBy: access.user.id,
          });
        return { id: lead.id };
      });
    },
    async update(headers: Headers, id: string, raw: unknown) {
      const { data, version } = updateLeadSchema.parse(raw);
      return mutation(headers, async (tx, access) => {
        const old = await versioned(tx, access, id, version);
        if (data.territory !== (old.territory ?? ""))
          await newBusinessAllowed(tx, old.organizationId, data.territory, false);
        if (
          data.organizationId !== old.organizationId ||
          data.customerId !== old.customerId ||
          data.projectId !== (old.projectId ?? "")
        )
          throw new AccessError(
            400,
            "Company, customer and project links cannot be changed on an existing lead",
          );
        if (old.outcome && (data.outcome !== old.outcome || data.stage !== 7))
          throw new AccessError(409, "Closed leads cannot be reopened through the lead editor");
        if (data.outcome === "won" && old.outcome !== "won")
          throw new AccessError(
            400,
            "Use the quotation-backed Convert to order form in the lead's Pre-sales workspace",
          );
        if (
          old.outcome === "won" &&
          (data.finalisedValue !== old.finalisedValue ||
            data.orderQty !== (old.orderQty ?? "") ||
            data.pleatedMeshQty !== (old.pleatedMeshQty ?? ""))
        )
          throw new AccessError(
            409,
            "Won order values and quantities are locked to the approved quotation",
          );
        if (data.stage > old.stage + 1 && data.outcome !== "lost")
          throw new AccessError(400, "Advance through the shared workflow one stage at a time");
        if (data.stage < old.stage)
          throw new AccessError(
            400,
            "Earlier stages cannot replace the recorded workflow; add a timeline note for revisions",
          );
        await validateAssignment(
          tx,
          access,
          data.organizationId,
          data.centreId,
          data.assignedTo,
          data.cseId,
        );
        if (
          (data.assignedTo !== old.assignedTo || data.centreId !== old.centreId) &&
          !canCoordinate(access, old.organizationId, old.centreId)
        )
          throw new AccessError(403, "Only branch coordinators can reassign leads");
        if (
          data.mobile !== old.mobile ||
          data.clientName !== old.clientName ||
          data.siteAddress !== old.siteAddress
        ) {
          const matches = await duplicates(tx, access, data, id);
          if ((matches.candidates.length || matches.restricted) && !data.duplicateAcknowledged)
            throw new DuplicateLeadError(matches.candidates, matches.restricted);
          if (matches.restricted && !canCoordinate(access, data.organizationId, data.centreId))
            throw new AccessError(
              409,
              "A matching contact requires coordinator review before changing this contact",
            );
        }
        const changes: Record<string, { before: unknown; after: unknown }> = {},
          next = values(data);
        for (const [key, value] of Object.entries(next)) {
          if (key === "updatedAt") continue;
          const previous = old[key as keyof typeof old];
          const a = previous instanceof Date ? previous.toISOString() : (previous ?? null),
            b = value instanceof Date ? value.toISOString() : (value ?? null);
          if (JSON.stringify(a) !== JSON.stringify(b)) changes[key] = { before: a, after: b };
        }
        const [lead] = await tx
          .update(leads)
          .set({
            ...next,
            closedAt: data.outcome === "open" ? null : (old.closedAt ?? new Date()),
            version: old.version + 1,
          })
          .where(and(eq(leads.id, id), eq(leads.organizationId, old.organizationId)))
          .returning();
        if (changes.assignedTo)
          await tx
            .update(leadFollowUps)
            .set({ assignedTo: data.assignedTo })
            .where(
              and(
                eq(leadFollowUps.leadId, id),
                eq(leadFollowUps.organizationId, old.organizationId),
                eq(leadFollowUps.state, "pending"),
              ),
            );
        if (changes.nextFollowUp || changes.nextAction) {
          const [currentNext] = await tx
            .select({ id: leadFollowUps.id })
            .from(leadFollowUps)
            .where(
              and(
                eq(leadFollowUps.leadId, id),
                eq(leadFollowUps.organizationId, old.organizationId),
                eq(leadFollowUps.state, "pending"),
              ),
            )
            .orderBy(asc(leadFollowUps.dueAt), asc(leadFollowUps.id))
            .limit(1);
          if (currentNext)
            await tx
              .update(leadFollowUps)
              .set({
                state: "cancelled",
                completedAt: new Date(),
                completionNotes: "Rescheduled in lead editor",
              })
              .where(
                and(
                  eq(leadFollowUps.leadId, id),
                  eq(leadFollowUps.organizationId, old.organizationId),
                  eq(leadFollowUps.state, "pending"),
                  eq(leadFollowUps.id, currentNext.id),
                ),
              );
          if (data.nextFollowUp && !lead.outcome)
            await tx.insert(leadFollowUps).values({
              organizationId: old.organizationId,
              leadId: id,
              assignedTo: data.assignedTo,
              dueAt: new Date(data.nextFollowUp),
              action: data.nextAction,
              createdBy: access.user.id,
            });
          await syncFollowUp(
            tx,
            id,
            old.organizationId,
            data.nextFollowUp ? null : data.nextAction || null,
          );
        }
        await activity(
          tx,
          access,
          lead,
          changes.assignedTo
            ? "assigned"
            : changes.stage || changes.outcome
              ? "stage-changed"
              : "edited",
          data.outcome === "lost"
            ? `Lost: ${data.lossReason}`
            : changes.stage
              ? `Moved to ${preSalesStages[data.stage - 1]}`
              : changes.assignedTo
                ? "Lead reassigned"
                : "Lead details updated",
          changes,
        );
        if (changes.stage || changes.outcome) await closeWorkflow(tx, access, lead, old.stage);
        return { id };
      });
    },
    async note(headers: Headers, id: string, raw: unknown) {
      const data = activitySchema.parse(raw);
      return mutation(headers, async (tx, access) => {
        const lead = await versioned(tx, access, id, data.version);
        await activity(tx, access, lead, "note", data.notes);
        await tx
          .update(leads)
          .set({ version: lead.version + 1, updatedAt: new Date() })
          .where(and(eq(leads.id, id), eq(leads.organizationId, lead.organizationId)));
        return { id };
      });
    },
    async addFollowUp(headers: Headers, id: string, raw: unknown) {
      const data = followUpSchema.parse(raw);
      return mutation(headers, async (tx, access) => {
        const lead = await versioned(tx, access, id, data.version);
        if (lead.outcome) throw new AccessError(409, "Closed leads cannot receive new follow-ups");
        await tx.insert(leadFollowUps).values({
          organizationId: lead.organizationId,
          leadId: id,
          assignedTo: lead.assignedTo!,
          dueAt: new Date(data.dueAt),
          action: data.action,
          createdBy: access.user.id,
        });
        await syncFollowUp(tx, id, lead.organizationId);
        await tx
          .update(leads)
          .set({ version: lead.version + 1, updatedAt: new Date() })
          .where(and(eq(leads.id, id), eq(leads.organizationId, lead.organizationId)));
        await activity(tx, access, lead, "follow-up-added", data.action, {
          dueAt: { before: null, after: data.dueAt },
        });
        return { id };
      });
    },
    async completeFollowUp(headers: Headers, id: string, followUpId: string, raw: unknown) {
      const data = activitySchema.parse(raw);
      return mutation(headers, async (tx, access) => {
        const lead = await versioned(tx, access, id, data.version);
        const [follow] = await tx
          .update(leadFollowUps)
          .set({ state: "completed", completedAt: new Date(), completionNotes: data.notes })
          .where(
            and(
              eq(leadFollowUps.id, z.uuid().parse(followUpId)),
              eq(leadFollowUps.leadId, id),
              eq(leadFollowUps.organizationId, lead.organizationId),
              eq(leadFollowUps.state, "pending"),
            ),
          )
          .returning();
        if (!follow) throw new AccessError(409, "Follow-up is unavailable or already completed");
        await syncFollowUp(tx, id, lead.organizationId);
        await tx
          .update(leads)
          .set({ version: lead.version + 1, updatedAt: new Date() })
          .where(and(eq(leads.id, id), eq(leads.organizationId, lead.organizationId)));
        await activity(tx, access, lead, "follow-up-completed", `${follow.action}: ${data.notes}`);
        return { id };
      });
    },
    async archive(headers: Headers, id: string, raw: unknown) {
      const data = z
        .object({
          version: z.number().int().positive(),
          reason: z.string().trim().min(3).max(500),
          restore: z.boolean().default(false),
        })
        .parse(raw);
      return mutation(headers, async (tx, access) => {
        const lead = await read(tx, access, id);
        if (!canCoordinate(access, lead.organizationId, lead.centreId)) throw new AccessError(403);
        if (lead.version !== data.version)
          throw new AccessError(409, "Refresh this lead before changing it");
        if (lead.outcome === "won") throw new AccessError(409, "Won orders must remain accessible");
        await tx
          .update(leads)
          .set({
            archivedAt: data.restore ? null : new Date(),
            version: lead.version + 1,
            updatedAt: new Date(),
          })
          .where(and(eq(leads.id, id), eq(leads.organizationId, lead.organizationId)));
        await activity(tx, access, lead, data.restore ? "restored" : "archived", data.reason);
        return { id };
      });
    },
    async directory(headers: Headers) {
      const access = await accessFor(headers),
        assignments = eligibleAssignments(access, "leads.read"),
        orgIds = [...new Set(assignments.map((a) => a.organizationId))];
      if (!orgIds.length) throw new AccessError(403);
      const orgs = await db.select().from(organizations).where(inArray(organizations.id, orgIds));
      const branchRows = await db
        .select()
        .from(centres)
        .where(and(inArray(centres.organizationId, orgIds), eq(centres.active, true)));
      const branches = branchRows.filter((c) =>
        assignments.some(
          (a) =>
            a.organizationId === c.organizationId &&
            (["Admin", "Super Admin"].includes(a.role) || a.centreId === c.id),
        ),
      );
      const people = await db
        .select({
          id: user.id,
          name: user.name,
          organizationId: employeeRoleAssignments.organizationId,
          centreId: employeeRoleAssignments.centreId,
          role: employeeRoleAssignments.role,
        })
        .from(employeeRoleAssignments)
        .innerJoin(user, eq(user.id, employeeRoleAssignments.userId))
        .innerJoin(employeeProfiles, eq(employeeProfiles.userId, user.id))
        .where(
          and(
            inArray(employeeRoleAssignments.organizationId, orgIds),
            eq(employeeProfiles.active, true),
            or(eq(user.banned, false), isNull(user.banned)),
          ),
        );
      const allGrants = await db
        .select()
        .from(rolePermissions)
        .where(inArray(rolePermissions.organizationId, orgIds));
      const employees = people
        .filter(
          (p) =>
            branches.some((c) => c.id === p.centreId) &&
            (canCoordinate(access, p.organizationId, p.centreId) ||
              p.id === access.user.id ||
              p.role === "CSE"),
        )
        .filter(
          (p) =>
            p.role === "CSE" ||
            ["Admin", "Super Admin"].includes(p.role) ||
            allGrants.some(
              (g) =>
                g.organizationId === p.organizationId &&
                g.role === p.role &&
                g.permission === "leads.write",
            ),
        );
      return {
        territories: await db
          .select({
            id: adminCatalog.id,
            name: adminCatalog.name,
            organizationId: adminCatalog.organizationId,
          })
          .from(adminCatalog)
          .where(
            and(
              inArray(adminCatalog.organizationId, orgIds),
              eq(adminCatalog.kind, "territory"),
              eq(adminCatalog.active, true),
            ),
          ),
        organizations: orgs,
        centres: branches,
        employees,
        canCreate: eligibleAssignments(access, "leads.write").length > 0,
        currentUserId: access.user.id,
        coordinatorCentres: branches
          .filter((c) => canCoordinate(access, c.organizationId, c.id))
          .map((c) => c.id),
      };
    },
    async customers(headers: Headers, raw: unknown = {}) {
      const access = await accessFor(headers),
        filters = leadFiltersSchema.parse(raw);
      const where = and(
        customerScope(db, access),
        filters.organizationId ? eq(customers.organizationId, filters.organizationId) : undefined,
        filters.q
          ? or(
              ilike(customers.name, pattern(filters.q)),
              ilike(customers.mobile, pattern(filters.q)),
            )
          : undefined,
      );
      const rows = await db
        .select()
        .from(customers)
        .where(where)
        .orderBy(desc(customers.createdAt), desc(customers.id))
        .limit(filters.pageSize)
        .offset((filters.page - 1) * filters.pageSize);
      const [n] = await db.select({ total: count() }).from(customers).where(where);
      return { rows, total: n.total, page: filters.page, pageSize: filters.pageSize };
    },
    async projects(headers: Headers, raw: unknown = {}) {
      const access = await accessFor(headers),
        filters = leadFiltersSchema
          .extend({ customerId: z.union([z.uuid(), z.literal("")]).default("") })
          .parse(raw);
      const where = and(
        projectScope(db, access),
        filters.organizationId ? eq(projects.organizationId, filters.organizationId) : undefined,
        filters.customerId ? eq(projects.customerId, filters.customerId) : undefined,
        filters.q ? ilike(projects.name, pattern(filters.q)) : undefined,
      );
      const rows = await db
        .select()
        .from(projects)
        .where(where)
        .orderBy(desc(projects.createdAt), desc(projects.id))
        .limit(filters.pageSize)
        .offset((filters.page - 1) * filters.pageSize);
      const [n] = await db.select({ total: count() }).from(projects).where(where);
      return { rows, total: n.total, page: filters.page, pageSize: filters.pageSize };
    },
    async createCustomer(headers: Headers, raw: unknown) {
      const data = customerSchema.parse(raw);
      return mutation(headers, async (tx, access) => {
        await validateAssignment(tx, access, data.organizationId, data.centreId, data.assignedTo);
        const [customer] = await tx
          .insert(customers)
          .values({ ...data, email: data.email || null })
          .returning();
        await tx.insert(auditLogs).values({
          actorId: access.user.id,
          organizationId: data.organizationId,
          targetId: customer.id,
          action: "customer.created",
        });
        return { id: customer.id };
      });
    },
    async createProject(headers: Headers, raw: unknown) {
      const data = projectSchema.parse(raw);
      return mutation(headers, async (tx, access) => {
        await validateAssignment(tx, access, data.organizationId, data.centreId, data.assignedTo);
        const [customer] = await tx
          .select()
          .from(customers)
          .where(
            and(
              eq(customers.id, data.customerId),
              eq(customers.organizationId, data.organizationId),
              customerScope(tx, access),
            ),
          );
        if (!customer) throw new AccessError(404, "Customer unavailable");
        const [project] = await tx.insert(projects).values(data).returning();
        await tx.insert(auditLogs).values({
          actorId: access.user.id,
          organizationId: data.organizationId,
          targetId: project.id,
          action: "project.created",
        });
        return { id: project.id };
      });
    },
  };
}
