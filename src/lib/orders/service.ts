import { requiredDocuments } from "../management/policies";
import { aftercareFiles } from "../db/schema";
import { assertAftercareStage } from "../aftercare/gates";
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import Decimal from "decimal.js";
import type { Database } from "../db";
import {
  auditLogs,
  centres,
  customers,
  documents,
  employeeProfiles,
  employeeRoleAssignments,
  leads,
  orders,
  orderItems,
  orderStages,
  orderStageEvents,
  orderStagePolicies,
  organizations,
  productionLoads,
  productionLoadItems,
  payments,
  projects,
  rolePermissions,
  user,
  workflowEvents,
} from "../db/schema";
import {
  AccessError,
  adminOrganizations,
  orderPredicate,
  requireAdmin,
  resolveAccess,
  type Access,
} from "../auth/access";
import { buildAuth, type AuthSettings } from "../auth/config";
import { eligibleAssignments } from "../leads/access";
import { stageDefinition } from "./definitions";
import {
  orderFiltersSchema,
  parseStageData,
  policySchema,
  stageActionSchema,
  stageNumber,
  validateMandatory,
} from "./validation";
import { initializeOrderStages } from "./initialize";
import type { FileStore } from "../presales/service";
type Order = typeof orders.$inferSelect;
type Stage = typeof orderStages.$inferSelect;
const snapshot = (record: object) => JSON.parse(JSON.stringify(record)) as Record<string, unknown>;
const current = alias(orderStages, "current_stage"),
  owner = alias(user, "stage_owner"),
  approver = alias(user, "stage_approver");
export function orderService(db: Database, settings: AuthSettings) {
  const access = (headers: Headers, tx = db) => resolveAccess(tx, buildAuth(tx, settings), headers);
  function scope(a: Access): SQL {
    return (
      or(
        ...[...new Set(eligibleAssignments(a, "orders.read").map((s) => s.organizationId))].map(
          (org) => orderPredicate(a, org, "orders.read"),
        ),
      ) ?? sql`false`
    );
  }
  async function read(tx: Database, a: Access, id: string) {
    const [order] = await tx
      .select({
        ...getTableColumns(orders),
        client: customers.name,
        mobile: customers.mobile,
        project: projects.name,
        siteAddress: projects.siteAddress,
        company: organizations.name,
        companySlug: organizations.slug,
      })
      .from(orders)
      .innerJoin(
        leads,
        and(eq(orders.leadId, leads.id), eq(orders.organizationId, leads.organizationId)),
      )
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .leftJoin(projects, eq(orders.projectId, projects.id))
      .innerJoin(organizations, eq(orders.organizationId, organizations.id))
      .where(and(eq(orders.id, z.uuid().parse(id)), eq(leads.outcome, "won"), scope(a)));
    if (!order) throw new AccessError(404, "Won order unavailable");
    return order;
  }
  function admin(a: Access, o: Order) {
    return adminOrganizations(a).includes(o.organizationId);
  }
  function manage(a: Access, o: Order) {
    return (
      admin(a, o) ||
      eligibleAssignments(a, "orders.manage").some(
        (s) => s.organizationId === o.organizationId && s.centreId === o.centreId,
      )
    );
  }
  function role(a: Access, o: Order, r: string) {
    return eligibleAssignments(a, "orders.read").some(
      (s) => s.organizationId === o.organizationId && s.centreId === o.centreId && s.role === r,
    );
  }
  function write(a: Access, o: Order, s: Stage) {
    return (
      admin(a, o) ||
      (s.assignedTo === a.user.id &&
        role(a, o, s.ownerRole) &&
        eligibleAssignments(a, stageDefinition(s.number).permission).some(
          (t) =>
            t.organizationId === o.organizationId &&
            t.centreId === o.centreId &&
            t.role === s.ownerRole,
        ))
    );
  }
  function review(a: Access, o: Order, s: Stage) {
    return (
      admin(a, o) ||
      (role(a, o, s.approverRole) &&
        eligibleAssignments(a, stageDefinition(s.number).approvalPermission).some(
          (t) =>
            t.organizationId === o.organizationId &&
            t.centreId === o.centreId &&
            t.role === s.approverRole,
        ))
    );
  }
  async function transaction<T>(
    headers: Headers,
    id: string,
    work: (tx: Database, a: Access, o: Awaited<ReturnType<typeof read>>) => Promise<T>,
  ) {
    return db.transaction(async (t) => {
      const tx = t as unknown as Database;
      await tx.execute(sql`select pg_advisory_xact_lock(73190021)`);
      const a = await access(headers, tx),
        o = await read(tx, a, id);
      return work(tx, a, o);
    });
  }
  async function event(
    tx: Database,
    a: Access,
    o: Order,
    s: Stage,
    action: string,
    before: Stage | null,
    notes = "",
  ) {
    await tx.insert(orderStageEvents).values({
      organizationId: o.organizationId,
      orderId: o.id,
      stageId: s.id,
      actorId: a.user.id,
      action,
      before: before ? snapshot(before) : null,
      after: snapshot(s),
      notes,
    });
    await tx.insert(auditLogs).values({
      organizationId: o.organizationId,
      actorId: a.user.id,
      targetId: o.id,
      action: `order.stage-${action}`,
      metadata: { stage: s.number, version: s.version },
    });
  }
  async function people(tx: Database, organizationIds: string[]) {
    if (!organizationIds.length) return [];
    const rows = await tx
      .select({
        id: user.id,
        name: user.name,
        role: employeeRoleAssignments.role,
        centreId: employeeRoleAssignments.centreId,
        organizationId: employeeRoleAssignments.organizationId,
      })
      .from(employeeRoleAssignments)
      .innerJoin(user, eq(user.id, employeeRoleAssignments.userId))
      .innerJoin(employeeProfiles, eq(employeeProfiles.userId, user.id))
      .innerJoin(centres, eq(centres.id, employeeRoleAssignments.centreId))
      .where(
        and(
          inArray(employeeRoleAssignments.organizationId, organizationIds),
          eq(employeeProfiles.active, true),
          eq(centres.active, true),
          or(eq(user.banned, false), isNull(user.banned)),
        ),
      );
    const grants = await tx
      .select()
      .from(rolePermissions)
      .where(inArray(rolePermissions.organizationId, organizationIds));
    return rows.map((r) => ({
      ...r,
      permissions: grants
        .filter((g) => g.organizationId === r.organizationId && g.role === r.role)
        .map((g) => g.permission),
    }));
  }
  async function completion(tx: Database, o: Awaited<ReturnType<typeof read>>, s: Stage) {
    await assertAftercareStage(tx, o.id, s.number);
    await requiredDocuments(tx, o.id, o.organizationId, s.number);
    const previous = await tx.select().from(orderStages).where(eq(orderStages.orderId, o.id));
    const stage = (n: number) => previous.find((p) => p.number === n);
    const [files] = await tx
      .select({ total: count() })
      .from(documents)
      .where(and(eq(documents.orderId, o.id), eq(documents.stageNumber, s.number)));
    const relevantKinds: Record<number, string[]> = {
      12: ["installation_photo"],
      13: ["installation_photo"],
      14: ["audit_photo"],
      15: ["handover_certificate", "installation_report", "warranty_document"],
    };
    const [evidence] = relevantKinds[s.number]
      ? await tx
          .select({ total: count() })
          .from(aftercareFiles)
          .where(
            and(
              eq(aftercareFiles.orderId, o.id),
              inArray(aftercareFiles.kind, relevantKinds[s.number]),
            ),
          )
      : [{ total: 0 }];
    validateMandatory(
      s.number,
      s.data,
      s.notes,
      s.requiredFields,
      files.total + evidence.total,
      o.companySlug === "s-grip" && (s.number !== 13 || stage(12)?.data.glassRequired === true),
    );
    if (
      previous.filter((p) => p.number < s.number).length !== s.number - 1 ||
      previous.some((p) => p.number < s.number && p.status !== "completed")
    )
      throw new Error("Complete and approve every preceding stage first");
    if (s.number === 2 && new Decimal(String(s.data.dueBeforeDispatch)).gt(o.finalValue ?? "0"))
      throw new Error("Contractually due amount cannot exceed the final order value");
    if (s.number === 7 && (!stage(4)?.approvedBy || stage(4)?.status !== "completed"))
      throw new Error("Approved final survey measurements are required before production release");
    if (s.number === 6) {
      const loads = await tx
        .select()
        .from(productionLoads)
        .where(eq(productionLoads.orderId, o.id));
      const [allocations] = await tx
        .select({ total: count() })
        .from(productionLoadItems)
        .innerJoin(productionLoads, eq(productionLoadItems.loadId, productionLoads.id))
        .where(eq(productionLoads.orderId, o.id));
      if (loads.length !== Number(s.data.loadCount) || allocations.total < 1)
        throw new Error(
          "Create and allocate production loads first, and match the planned load count to the actual loads",
        );
    }
    if (s.number >= 7) {
      const [loads] = await tx
        .select({ total: count() })
        .from(productionLoads)
        .where(eq(productionLoads.orderId, o.id));
      if (loads.total < 1) throw new Error("Plan production loads before release");
    }
    if (s.number === 9 || s.number === 10) {
      const due = stage(2)?.data.dueBeforeDispatch,
        receipts = s.number === 9 ? s.data.verifiedReceipts : stage(9)?.data.verifiedReceipts;
      if (typeof due !== "string" || typeof receipts !== "string" || new Decimal(receipts).lt(due))
        throw new Error("Verified receipts do not cover the contractually due amount");
      if (s.number === 10 && (!stage(9)?.approvedBy || stage(9)?.status !== "completed"))
        throw new Error("Payment verification must be approved before dispatch");
    }
    if (s.number === 9) {
      const receipts = await tx
        .select()
        .from(payments)
        .where(and(eq(payments.orderId, o.id), eq(payments.status, "verified")));
      const verified = receipts.reduce((n, p) => n.plus(p.amount), new Decimal(0));
      if (!verified.eq(String(s.data.verifiedReceipts)))
        throw new Error("Recorded verified installments must support the claimed receipt total");
    }
    if (s.number === 10 || s.number === 11) {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, o.id));
      const loads = await tx
        .select()
        .from(productionLoads)
        .where(eq(productionLoads.orderId, o.id));
      const allocations = await tx
        .select({ loadId: productionLoadItems.loadId })
        .from(productionLoadItems)
        .innerJoin(productionLoads, eq(productionLoadItems.loadId, productionLoads.id))
        .where(eq(productionLoads.orderId, o.id));
      const applicable = new Set(allocations.map((a) => a.loadId));
      const statuses =
        s.number === 10
          ? [
              "dispatched",
              "delivered",
              "installation_started",
              "installed",
              "audit_passed",
              "completed",
            ]
          : ["delivered", "installation_started", "installed", "audit_passed", "completed"];
      if (
        !items.length ||
        items.some((i) => !new Decimal(i.quantity).eq(i.allocatedQuantity)) ||
        !applicable.size ||
        loads.some((l) => applicable.has(l.id) && !statuses.includes(l.status))
      )
        throw new Error(
          "Complete actual shipment / delivery quantities for every allocated load first",
        );
    }
    if (
      s.number === 13 &&
      o.companySlug === "s-grip" &&
      stage(12)?.data.glassRequired === true &&
      ["glassMeasurementTaken", "glassTemplatePrepared", "glassTemplateApproved"].some(
        (k) => s.data[k] !== true,
      )
    )
      throw new Error(
        "Complete glass measurement, template preparation and template approval inside this order",
      );
    if (
      s.number === 15 &&
      (stage(13)?.status !== "completed" ||
        stage(13)?.data.allLoadsInstalled !== true ||
        stage(14)?.status !== "completed" ||
        stage(14)?.data.auditPassed !== true ||
        !stage(14)?.approvedBy)
    )
      throw new Error(
        "Approved installation and service engineer audit checks are required for handover",
      );
    if (s.number === 16 && stage(15)?.status !== "completed")
      throw new Error("Review requests follow approved handover");
    if (s.number === 15) {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, o.id));
      const loads = await tx
        .select()
        .from(productionLoads)
        .where(eq(productionLoads.orderId, o.id));
      const allocations = await tx
        .select({ loadId: productionLoadItems.loadId })
        .from(productionLoadItems)
        .innerJoin(productionLoads, eq(productionLoadItems.loadId, productionLoads.id))
        .where(eq(productionLoads.orderId, o.id));
      const applicable = new Set(allocations.map((a) => a.loadId));
      if (
        !items.length ||
        items.some((i) => !new Decimal(i.allocatedQuantity).eq(i.quantity)) ||
        !applicable.size ||
        loads.some((l) => applicable.has(l.id) && l.status !== "completed")
      )
        throw new Error(
          "Allocate every confirmed item and complete all allocated production loads before handover",
        );
      if (
        loads.some(
          (l) =>
            applicable.has(l.id) &&
            l.completedAt &&
            new Date(String(s.data.handoverAt)) < l.completedAt,
        )
      )
        throw new Error("Handover cannot precede the completion date of an allocated load");
    }
    const chronology: Record<number, [string, number, string]> = {
      10: ["dispatchedAt", 9, "verifiedAt"],
      11: ["deliveredAt", 10, "dispatchedAt"],
      12: ["installationStartedAt", 11, "deliveredAt"],
      13: ["installationCompletedAt", 12, "installationStartedAt"],
      14: ["auditAt", 13, "installationCompletedAt"],
      15: ["handoverAt", 14, "auditAt"],
      16: ["reviewRequestedAt", 15, "handoverAt"],
    };
    const sequence = chronology[s.number];
    if (
      sequence &&
      new Date(String(s.data[sequence[0]])) <
        new Date(String(stage(sequence[1])?.data[sequence[2]]))
    )
      throw new Error("The recorded evidence date cannot precede its prerequisite activity");
  }
  return {
    async list(headers: Headers, raw: unknown = {}) {
      const a = await access(headers);
      if (!eligibleAssignments(a, "orders.read").length) throw new AccessError(403);
      const filters = orderFiltersSchema.parse(raw),
        where = and(
          scope(a),
          eq(leads.outcome, "won"),
          filters.organizationId ? eq(orders.organizationId, filters.organizationId) : undefined,
          filters.q
            ? or(
                ilike(customers.name, `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`),
                ilike(projects.name, `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`),
              )
            : undefined,
          filters.status === "completed"
            ? sql`${orders.completedAt} is not null`
            : filters.status
              ? isNull(orders.completedAt)
              : undefined,
          filters.status === "overdue"
            ? sql`${current.plannedAt}<now()`
            : filters.status === "unassigned"
              ? isNull(current.assignedTo)
              : filters.status === "awaiting_approval"
                ? eq(current.status, "awaiting_approval")
                : filters.status === "mine"
                  ? eq(current.assignedTo, a.user.id)
                  : undefined,
        );
      const from = () =>
        db
          .select({
            id: orders.id,
            createdAt: orders.createdAt,
            completedAt: orders.completedAt,
            client: customers.name,
            company: organizations.name,
            project: projects.name,
            stage: orders.stage,
            stageStatus: current.status,
            plannedAt: current.plannedAt,
            assignedName: owner.name,
            finalValue: orders.finalValue,
          })
          .from(orders)
          .innerJoin(leads, eq(leads.id, orders.leadId))
          .innerJoin(customers, eq(customers.id, orders.customerId))
          .leftJoin(projects, eq(projects.id, orders.projectId))
          .innerJoin(organizations, eq(organizations.id, orders.organizationId))
          .leftJoin(current, and(eq(current.orderId, orders.id), eq(current.number, orders.stage)))
          .leftJoin(owner, eq(owner.id, current.assignedTo));
      const rows = await from()
        .where(where)
        .orderBy(desc(orders.createdAt), desc(orders.id))
        .limit(20)
        .offset((filters.page - 1) * 20);
      const [totals] = await db
        .select({
          total: count(),
          active: sql<number>`count(*) filter(where ${orders.completedAt} is null)`.mapWith(Number),
          completed: sql<number>`count(*) filter(where ${orders.completedAt} is not null)`.mapWith(
            Number,
          ),
          overdue:
            sql<number>`count(*) filter(where ${orders.completedAt} is null and ${current.plannedAt}<now())`.mapWith(
              Number,
            ),
          unassigned:
            sql<number>`count(*) filter(where ${orders.completedAt} is null and ${current.assignedTo} is null)`.mapWith(
              Number,
            ),
          awaiting:
            sql<number>`count(*) filter(where ${current.status}='awaiting_approval')`.mapWith(
              Number,
            ),
        })
        .from(orders)
        .innerJoin(leads, eq(leads.id, orders.leadId))
        .innerJoin(customers, eq(customers.id, orders.customerId))
        .leftJoin(projects, eq(projects.id, orders.projectId))
        .leftJoin(current, and(eq(current.orderId, orders.id), eq(current.number, orders.stage)))
        .where(where);
      const orgIds = [
          ...new Set(eligibleAssignments(a, "orders.read").map((s) => s.organizationId)),
        ],
        companies = orgIds.length
          ? await db
              .select({ id: organizations.id, name: organizations.name })
              .from(organizations)
              .where(inArray(organizations.id, orgIds))
          : [];
      return {
        rows,
        totals,
        page: filters.page,
        companies,
        canConfigure: adminOrganizations(a).length > 0,
      };
    },
    async detail(headers: Headers, id: string, raw: unknown = {}) {
      const options = z
          .object({
            historyPage: z.coerce.number().int().min(1).max(100000).default(1),
            filePage: z.coerce.number().int().min(1).max(100000).default(1),
            fileStage: stageNumber.optional(),
          })
          .parse(raw),
        a = await access(headers),
        order = await read(db, a, id),
        fileStage = options.fileStage ?? order.stage;
      const stages = await db
        .select({
          ...getTableColumns(orderStages),
          assignedName: owner.name,
          approvedName: approver.name,
        })
        .from(orderStages)
        .leftJoin(owner, eq(orderStages.assignedTo, owner.id))
        .leftJoin(approver, eq(orderStages.approvedBy, approver.id))
        .where(eq(orderStages.orderId, id))
        .orderBy(asc(orderStages.number));
      const events = await db
          .select({
            ...getTableColumns(orderStageEvents),
            actorName: user.name,
            number: orderStages.number,
          })
          .from(orderStageEvents)
          .innerJoin(user, eq(user.id, orderStageEvents.actorId))
          .innerJoin(orderStages, eq(orderStages.id, orderStageEvents.stageId))
          .where(eq(orderStageEvents.orderId, id))
          .orderBy(desc(orderStageEvents.createdAt), desc(orderStageEvents.id))
          .limit(25)
          .offset((options.historyPage - 1) * 25),
        [eventCount] = await db
          .select({ total: count() })
          .from(orderStageEvents)
          .where(eq(orderStageEvents.orderId, id));
      const fileWhere = and(eq(documents.orderId, id), eq(documents.stageNumber, fileStage)),
        files = await db
          .select({
            id: documents.id,
            name: documents.name,
            contentType: documents.contentType,
            byteSize: documents.byteSize,
            stageNumber: documents.stageNumber,
            requirementId: documents.requirementId,
            createdAt: documents.createdAt,
          })
          .from(documents)
          .where(fileWhere)
          .orderBy(desc(documents.createdAt), desc(documents.id))
          .limit(20)
          .offset((options.filePage - 1) * 20),
        [fileCount] = await db.select({ total: count() }).from(documents).where(fileWhere);
      const employees = (await people(db, [order.organizationId])).filter(
          (p) => p.centreId === order.centreId,
        ),
        loads = await db
          .select()
          .from(productionLoads)
          .where(eq(productionLoads.orderId, id))
          .orderBy(asc(productionLoads.loadNumber)),
        items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
      return {
        order,
        stages: stages.map((s) => ({
          ...s,
          canWrite: write(a, order, s),
          canApprove: review(a, order, s),
        })),
        events,
        historyPage: options.historyPage,
        historyTotal: eventCount.total,
        files,
        filePage: options.filePage,
        fileTotal: fileCount.total,
        requirements: stages.flatMap((stage) =>
          stage.documentRequirements.map((r) => ({ ...r, config: { stageNumber: stage.number } })),
        ),
        fileStage,
        employees,
        loads,
        items,
        canManage: manage(a, order),
      };
    },
    async initialize(headers: Headers, id: string) {
      return transaction(headers, id, async (tx, a, o) => {
        if (!manage(a, o)) throw new AccessError(403);
        await initializeOrderStages(tx, o, a.user.id);
        return { id };
      });
    },
    async transition(headers: Headers, id: string, number: number, raw: unknown) {
      const n = stageNumber.parse(number),
        input = stageActionSchema.parse(raw);
      return transaction(headers, id, async (tx, a, o) => {
        const [s] = await tx
          .select()
          .from(orderStages)
          .where(and(eq(orderStages.orderId, id), eq(orderStages.number, n)));
        if (!s) throw new AccessError(409, "Initialize the workflow before editing stages");
        if (s.version !== input.version)
          throw new AccessError(409, "Stage changed. Reload before saving.");
        if (s.status === "completed" || o.completedAt)
          throw new AccessError(409, "Approved stage history is immutable");
        if (input.action === "plan") {
          if (!manage(a, o))
            throw new AccessError(
              403,
              "Only order coordinators can assign stage owners and target dates",
            );
          if (s.status === "awaiting_approval")
            throw new AccessError(409, "Review or reject the submission before reassignment");
          if (!input.assignedTo || !input.plannedAt)
            throw new AccessError(400, "Choose an owner and planned date");
          const candidates = await people(tx, [o.organizationId]);
          const target = candidates.find(
            (p) =>
              p.id === input.assignedTo &&
              p.centreId === o.centreId &&
              (["Admin", "Super Admin"].includes(p.role) ||
                (p.role === s.ownerRole &&
                  p.permissions.includes("orders.read") &&
                  p.permissions.includes(stageDefinition(n).permission))),
          );
          if (!target)
            throw new AccessError(
              400,
              "Select an active employee with the configured stage role and permission in this branch",
            );
          const [next] = await tx
            .update(orderStages)
            .set({
              assignedTo: input.assignedTo,
              plannedAt: new Date(input.plannedAt),
              version: s.version + 1,
              updatedAt: new Date(),
            })
            .where(eq(orderStages.id, s.id))
            .returning();
          await event(tx, a, o, next, "assigned", s);
          return { id: s.id };
        }
        if (o.stage !== n)
          throw new AccessError(
            409,
            "Stages cannot be skipped. Complete and approve the current stage first",
          );
        const previous = await tx
          .select({ number: orderStages.number, status: orderStages.status })
          .from(orderStages)
          .where(eq(orderStages.orderId, id));
        if (
          previous.length !== 16 ||
          previous.some((p) => p.number < n && p.status !== "completed")
        )
          throw new AccessError(409, "Previous stages are not fully approved");
        if (input.action === "approve" || input.action === "reject") {
          if (!review(a, o, s))
            throw new AccessError(403, "You are not an authorized reviewer for this stage");
          if (s.status !== "awaiting_approval")
            throw new AccessError(409, "Submit this stage for approval first");
          if (input.action === "reject") {
            if (input.reason.length < 3)
              throw new AccessError(400, "A rejection / revision reason is required");
            const [next] = await tx
              .update(orderStages)
              .set({ status: "changes_requested", version: s.version + 1, updatedAt: new Date() })
              .where(eq(orderStages.id, s.id))
              .returning();
            await event(tx, a, o, next, "changes-requested", s, input.reason);
            return { id: s.id };
          }
          try {
            await completion(tx, o, s);
          } catch (error) {
            throw new AccessError(400, (error as Error).message);
          }
          const [next] = await tx
            .update(orderStages)
            .set({
              status: "completed",
              approvedBy: a.user.id,
              completedAt: new Date(),
              version: s.version + 1,
              updatedAt: new Date(),
            })
            .where(eq(orderStages.id, s.id))
            .returning();
          await event(tx, a, o, next, "approved", s, input.reason);
          await tx
            .update(orders)
            .set({
              stage: n === 16 ? 16 : n + 1,
              completedAt: n === 16 ? new Date() : null,
              updatedAt: new Date(),
            })
            .where(eq(orders.id, id));
          await tx.insert(workflowEvents).values({
            organizationId: o.organizationId,
            orderId: id,
            actorId: a.user.id,
            fromStage: n,
            toStage: n === 16 ? 16 : n + 1,
            notes: `${s.name} approved${n === 16 ? "; workflow completed" : "; next stage pending"}`,
          });
          return { id: s.id };
        }
        if (!write(a, o, s))
          throw new AccessError(
            403,
            "Only the assigned stage owner with the required permission can record evidence",
          );
        if (!s.assignedTo || !s.plannedAt)
          throw new AccessError(400, "Assign an owner and planned date first");
        if (input.action === "start") {
          if (s.status !== "pending")
            throw new AccessError(409, "Only a pending stage can be started");
          const [next] = await tx
            .update(orderStages)
            .set({
              status: "in_progress",
              startedAt: new Date(),
              version: s.version + 1,
              updatedAt: new Date(),
            })
            .where(eq(orderStages.id, s.id))
            .returning();
          await event(tx, a, o, next, "started", s);
          return { id: s.id };
        }
        if (!["in_progress", "changes_requested"].includes(s.status))
          throw new AccessError(
            409,
            "Start the stage, or request changes to its submission, before editing",
          );
        let data: Record<string, unknown>;
        try {
          data = parseStageData(n, input.data);
        } catch {
          throw new AccessError(
            400,
            "Check the stage fields, measurement units, dates and numeric formats",
          );
        }
        const candidate = { ...s, data, notes: input.notes };
        if (input.action === "submit") {
          try {
            await completion(tx, o, candidate);
          } catch (error) {
            throw new AccessError(400, (error as Error).message);
          }
        }
        const [next] = await tx
          .update(orderStages)
          .set({
            data,
            notes: input.notes,
            status: input.action === "submit" ? "awaiting_approval" : s.status,
            submittedAt: input.action === "submit" ? new Date() : s.submittedAt,
            submittedBy: input.action === "submit" ? a.user.id : s.submittedBy,
            version: s.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(orderStages.id, s.id))
          .returning();
        await event(tx, a, o, next, input.action === "submit" ? "submitted" : "saved", s);
        return { id: s.id };
      });
    },
    async configuration(headers: Headers) {
      const a = await access(headers),
        orgIds = adminOrganizations(a);
      if (!orgIds.length) throw new AccessError(403);
      const companies = await db
          .select({ id: organizations.id, name: organizations.name })
          .from(organizations)
          .where(inArray(organizations.id, orgIds)),
        policies = await db
          .select()
          .from(orderStagePolicies)
          .where(inArray(orderStagePolicies.organizationId, orgIds));
      return { companies, policies };
    },
    async configure(headers: Headers, raw: unknown) {
      const data = policySchema.parse(raw),
        def = stageDefinition(data.number),
        known = new Set(["notes", "attachments", ...def.fields.map((f) => f.key)]);
      if (data.requiredFields.some((k) => !known.has(k)))
        throw new AccessError(400, "Unknown mandatory stage field");
      if (def.requiredFields.some((k) => !data.requiredFields.includes(k)))
        throw new AccessError(400, "Core business requirements cannot be removed");
      return db.transaction(async (transaction) => {
        const tx = transaction as unknown as Database;
        await tx.execute(sql`select pg_advisory_xact_lock(73190021)`);
        const a = await access(headers, tx);
        requireAdmin(a, data.organizationId);
        const grants = await tx
            .select()
            .from(rolePermissions)
            .where(eq(rolePermissions.organizationId, data.organizationId)),
          has = (role: string, p: string) =>
            ["Admin", "Super Admin"].includes(role) ||
            grants.some((g) => g.role === role && g.permission === p);
        if (
          !has(data.ownerRole, "orders.read") ||
          !has(data.ownerRole, def.permission) ||
          !has(data.approverRole, "orders.read") ||
          !has(data.approverRole, def.approvalPermission)
        )
          throw new AccessError(
            400,
            "Configured roles need order read access; the owner role also needs its stage module permission",
          );
        const [old] = await tx
          .select()
          .from(orderStagePolicies)
          .where(
            and(
              eq(orderStagePolicies.organizationId, data.organizationId),
              eq(orderStagePolicies.number, data.number),
            ),
          );
        if ((old?.version ?? 0) !== data.version)
          throw new AccessError(409, "Stage configuration changed. Reload before saving.");
        const values = {
          ownerRole: data.ownerRole,
          approverRole: data.approverRole,
          requiredFields: [...new Set(data.requiredFields)],
          changedBy: a.user.id,
          version: (old?.version ?? 0) + 1,
          updatedAt: new Date(),
        };
        const [policy] = old
          ? await tx
              .update(orderStagePolicies)
              .set(values)
              .where(eq(orderStagePolicies.id, old.id))
              .returning()
          : await tx
              .insert(orderStagePolicies)
              .values({ ...values, organizationId: data.organizationId, number: data.number })
              .returning();
        if (data.applyToPending) {
          const pending = await tx
            .select()
            .from(orderStages)
            .where(
              and(
                eq(orderStages.organizationId, data.organizationId),
                eq(orderStages.number, data.number),
                eq(orderStages.status, "pending"),
              ),
            )
            .limit(201);
          if (pending.length > 200)
            throw new AccessError(
              400,
              "More than 200 pending stages match. Save for future orders or apply in a scoped maintenance operation.",
            );
          for (const s of pending) {
            const [next] = await tx
              .update(orderStages)
              .set({
                ownerRole: data.ownerRole,
                approverRole: data.approverRole,
                requiredFields: values.requiredFields,
                assignedTo: s.ownerRole === data.ownerRole ? s.assignedTo : null,
                version: s.version + 1,
                updatedAt: new Date(),
              })
              .where(eq(orderStages.id, s.id))
              .returning();
            await event(
              tx,
              a,
              { id: s.orderId, organizationId: s.organizationId } as Order,
              next,
              "policy-updated",
              s,
            );
          }
        }
        await tx.insert(auditLogs).values({
          organizationId: data.organizationId,
          actorId: a.user.id,
          targetId: policy.id,
          action: "order.stage-policy-updated",
          metadata: {
            before: old ? snapshot(old) : null,
            after: snapshot(policy),
            applyToPending: data.applyToPending,
          },
        });
        return { id: policy.id };
      });
    },
    async upload(
      headers: Headers,
      id: string,
      number: number,
      input: { name: string; contentType: string; bytes: Uint8Array; requirementId?: string },
      store: FileStore,
    ) {
      const n = stageNumber.parse(number),
        name = z.string().trim().min(1).max(180).parse(input.name),
        bytes = input.bytes;
      if (bytes.length < 1 || bytes.length > 4194304)
        throw new AccessError(400, "Files must be 1 byte to 4 MiB");
      const valid =
        input.contentType === "application/pdf"
          ? Buffer.from(bytes.slice(0, 5)).toString() === "%PDF-"
          : input.contentType === "image/jpeg"
            ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
            : input.contentType === "image/png"
              ? Buffer.from(bytes.slice(0, 8)).equals(
                  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
                )
              : false;
      if (!valid) throw new AccessError(400, "Upload a valid PDF, JPEG or PNG");
      let uploaded: string | undefined;
      try {
        return await transaction(headers, id, async (tx, a, o) => {
          const [s] = await tx
            .select()
            .from(orderStages)
            .where(and(eq(orderStages.orderId, id), eq(orderStages.number, n)));
          if (
            !s ||
            s.number !== o.stage ||
            !["pending", "in_progress", "changes_requested"].includes(s.status)
          )
            throw new AccessError(
              409,
              "Attachments can be added only to the current, unsubmitted stage",
            );
          if (!write(a, o, s)) throw new AccessError(403);
          if (
            input.requirementId &&
            !s.documentRequirements.some((r) => r.id === z.uuid().parse(input.requirementId))
          )
            throw new AccessError(400, "Choose a document requirement from this order stage");
          const objectPath = `${o.organizationId}/${id}/stages/${n}/${crypto.randomUUID()}`;
          await store.upload(objectPath, bytes, input.contentType);
          uploaded = objectPath;
          const [file] = await tx
            .insert(documents)
            .values({
              organizationId: o.organizationId,
              orderId: id,
              stageNumber: n,
              requirementId: input.requirementId ? z.uuid().parse(input.requirementId) : null,
              uploadedBy: a.user.id,
              name,
              objectPath,
              contentType: input.contentType,
              byteSize: bytes.length,
            })
            .returning();
          const [next] = await tx
            .update(orderStages)
            .set({ updatedAt: new Date() })
            .where(eq(orderStages.id, s.id))
            .returning();
          await event(tx, a, o, next, "document-uploaded", s, `Attachment: ${name}`);
          return { id: file.id };
        });
      } catch (error) {
        if (uploaded) await store.remove(uploaded).catch(() => undefined);
        throw error;
      }
    },
    async download(headers: Headers, id: string, fileId: string, store: FileStore) {
      const a = await access(headers),
        o = await read(db, a, id),
        [file] = await db
          .select()
          .from(documents)
          .where(
            and(
              eq(documents.id, z.uuid().parse(fileId)),
              eq(documents.orderId, id),
              eq(documents.organizationId, o.organizationId),
            ),
          );
      if (
        !file ||
        file.stageNumber === null ||
        !file.objectPath.startsWith(`${o.organizationId}/${id}/stages/${file.stageNumber}/`)
      )
        throw new AccessError(404, "Stage document unavailable");
      return { url: await store.sign(file.objectPath), expiresIn: 60 };
    },
  };
}
