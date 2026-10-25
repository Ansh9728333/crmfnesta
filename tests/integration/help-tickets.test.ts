import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import * as schema from "../../src/lib/db/schema";
import type { Database } from "../../src/lib/db";
import { bootstrapAdmin } from "../../src/lib/auth/bootstrap";
import { buildAuth } from "../../src/lib/auth/config";
import { employeeService } from "../../src/lib/employees/service";
import { leadService } from "../../src/lib/leads/service";
import { leadFormSchema } from "../../src/lib/leads/validation";
import { helpService, type HelpStore } from "../../src/lib/help-tickets/service";
import { notificationService } from "../../src/lib/management/notifications";
const pg = new PGlite(),
  db = drizzle(pg, { schema }) as unknown as Database,
  settings = {
    url: "http://localhost:3000",
    secret: randomUUID() + randomUUID(),
    rateLimit: false,
  },
  auth = buildAuth(db, settings),
  password = `Test-${randomUUID()}`,
  employees = employeeService(db, settings),
  leads = leadService(db, settings),
  objects = new Map<string, Uint8Array>();
const store: HelpStore = {
  async prepare(path) {
    objects.set(path, new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));
    return { signedUrl: "https://storage.example.test/upload" };
  },
  async read(path) {
    return objects.get(path)!;
  },
  async sign() {
    return "https://storage.example.test/private";
  },
};
const service = helpService(db, settings, store),
  notifications = notificationService(db, settings);
let admin: Headers,
  accounts: Headers,
  accountsId: string,
  independentAdmin: Headers,
  creator: Headers,
  resolver: Headers,
  peer: Headers,
  otherBranch: Headers,
  secondResolver: Headers,
  org: string,
  centre: string,
  leadId: string,
  projectId: string,
  resolverId: string,
  creatorId: string,
  secondId: string,
  peerId: string,
  ticketId: string;
async function login(username: string) {
  const r = await auth.api.signInUsername({ body: { username, password }, asResponse: true });
  return new Headers({
    origin: settings.url,
    cookie: r.headers
      .getSetCookie()
      .map((x) => x.split(";")[0])
      .join("; "),
  });
}
function input() {
  return {
    kind: "lead",
    id: leadId,
    requestId: randomUUID(),
    concern: "service",
    details: "Customer reports a window locking issue",
    assignedTo: resolverId,
    priority: "high",
  };
}
async function change(
  h: Headers,
  id: string,
  action: string,
  notes = "Recorded action with reason",
  extra: Record<string, unknown> = {},
) {
  const d = await service.detail(h, id);
  return service.change(h, id, { action, version: d.ticket.version, notes, ...extra });
}
beforeAll(async () => {
  await pg.exec("create role anon;create role authenticated;");
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" }))
    for (const statement of migration.sql) await pg.exec(statement);
  await bootstrapAdmin(db, settings, {
    name: "Help Admin",
    email: "help-admin@example.test",
    username: "help.admin",
    password,
    mobile: "9000000001",
    centre: "Main",
  });
  admin = await login("help.admin");
  const [o] = await db.select().from(schema.organizations).orderBy(schema.organizations.slug);
  org = o.id;
  const [c] = await db.select().from(schema.centres).where(eq(schema.centres.organizationId, org));
  centre = c.id;
  const branch = await employees.createCentre(admin, { organizationId: org, name: "Other branch" });
  for (const [key, role, location] of [
    ["creator", "Sales Executive", centre],
    ["resolver", "Service Engineer", centre],
    ["peer", "Sales Executive", centre],
    ["second", "Service Engineer", centre],
    ["branch", "Service Engineer", branch.id],
    ["independent", "Admin", centre],
    ["accounts", "Accounts", centre],
  ] as const) {
    const p = await employees.create(admin, {
      name: `Help ${key}`,
      username: `help.${key}`,
      email: `help-${key}@example.test`,
      password,
      mobile: "9000000002",
      department: "Customer care",
      active: true,
      assignments: [{ organizationId: org, centreId: location, role }],
    });
    const h = await login(`help.${key}`);
    if (key === "accounts") {
      accounts = h;
      accountsId = p.id;
    }
    if (key === "independent") independentAdmin = h;
    if (key === "creator") {
      creator = h;
      creatorId = p.id;
    }
    if (key === "resolver") {
      resolver = h;
      resolverId = p.id;
    }
    if (key === "peer") {
      peer = h;
      peerId = p.id;
    }
    if (key === "second") {
      secondResolver = h;
      secondId = p.id;
    }
    if (key === "branch") otherBranch = h;
  }
  const lead = await leads.create(
    creator,
    leadFormSchema.parse({
      organizationId: org,
      centreId: centre,
      assignedTo: creatorId,
      clientName: "Help customer",
      mobile: "9876599991",
      projectName: "Help villa",
      siteAddress: "Isolated test project address",
    }),
  );
  leadId = lead.id;
  projectId = (await leads.detail(creator, leadId)).lead.projectId!;
});
afterAll(() => pg.close());
describe("persisted customer help workflow", () => {
  it("uses actual lead client, location and session creator before handover", async () => {
    const ctx = await service.context(creator, { kind: "lead", id: leadId });
    expect(ctx.source.client).toBe("Help customer");
    expect(ctx.resolvers.map((x) => x.id)).toContain(resolverId);
    const ticket = await service.create(creator, input());
    ticketId = ticket.id;
    expect(ticket.createdBy).toBe(creatorId);
    expect(ticket.projectId).toBe(projectId);
    expect(ticket.status).toBe("raised");
    expect(ticket.dueAt).toBeNull();
    expect((await helpService(db, settings).detail(creator, ticket.id)).info.client).toBe(
      "Help customer",
    );
    expect((await db.select().from(schema.handovers)).length).toBe(0);
  });
  it("notifies the assigned resolver without exposing leads or tickets to peers", async () => {
    const task = (await notifications.list(resolver)).rows.find((x) => x.entity_id === ticketId)!;
    await notifications.change(resolver, {
      kind: "help_ticket",
      entityId: task.entity_id,
      dueAt: task.due_at,
      state: "read",
    });
    expect(
      (await notifications.list(resolver, { unread: "yes" })).rows.some(
        (x) => x.entity_id === ticketId,
      ),
    ).toBe(false);
    expect((await notifications.list(resolver)).rows.some((x) => x.entity_id === ticketId)).toBe(
      true,
    );
    expect((await notifications.list(peer)).rows.some((x) => x.entity_id === ticketId)).toBe(false);
    await expect(service.detail(peer, ticketId)).rejects.toMatchObject({ status: 404 });
    await expect(service.detail(otherBranch, ticketId)).rejects.toMatchObject({ status: 404 });
    await expect(leads.detail(resolver, leadId)).rejects.toMatchObject({ status: 403 });
    expect(await service.sources(resolver, {})).toHaveLength(0);
  });
  it("rejects unauthorized actions and closure before resolution", async () => {
    await expect(change(creator, ticketId, "resolve")).rejects.toMatchObject({ status: 403 });
    await expect(change(admin, ticketId, "close")).rejects.toMatchObject({ status: 409 });
    await expect(
      change(resolver, ticketId, "reassign", "New owner", { assignedTo: secondId }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.create(creator, { ...input(), assignedTo: "unknown-employee" }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("returns a resolution to the creator and retains every rejected attempt", async () => {
    await change(resolver, ticketId, "start");
    await change(resolver, ticketId, "resolve", "Adjusted the lock and tested the handle");
    expect((await service.detail(creator, ticketId)).canConfirm).toBe(true);
    expect((await notifications.list(creator)).rows.some((x) => x.entity_id === ticketId)).toBe(
      true,
    );
    expect((await notifications.list(resolver)).rows.some((x) => x.entity_id === ticketId)).toBe(
      false,
    );
    await expect(change(resolver, ticketId, "close")).rejects.toMatchObject({ status: 403 });
    await change(creator, ticketId, "reopen", "Customer confirms the lock is still sticking");
    await change(resolver, ticketId, "resolve", "Replaced the damaged lock and retested");
    await change(creator, ticketId, "close", "Customer confirms the problem is resolved");
    const d = await service.detail(creator, ticketId);
    expect(d.ticket.status).toBe("closed");
    expect(d.events.filter((x) => x.action === "resolve")).toHaveLength(2);
    expect((await notifications.list(creator)).rows.some((x) => x.entity_id === ticketId)).toBe(
      false,
    );
    await change(creator, ticketId, "reopen", "Customer reports the problem has recurred");
  });
  it("supports Admin reassignment and invalidates previous resolver access", async () => {
    await change(admin, ticketId, "reassign", "Engineer transferred; new owner assigned", {
      assignedTo: secondId,
    });
    await expect(service.detail(resolver, ticketId)).rejects.toMatchObject({ status: 404 });
    await change(secondResolver, ticketId, "resolve", "Replacement engineer completed the repair");
    await change(creator, ticketId, "close", "Customer confirmed satisfactory repair");
  });
  it("prevents lost updates, duplicate submission and unauthorized selection", async () => {
    const i = input(),
      first = await service.create(creator, i),
      again = await service.create(creator, i);
    expect(again.id).toBe(first.id);
    await service.change(resolver, first.id, {
      action: "start",
      version: 1,
      notes: "Starting work",
    });
    await expect(
      service.change(resolver, first.id, { action: "resolve", version: 1, notes: "Stale request" }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await service.context(peer, { kind: "lead", id: leadId })).source.client).toBe(
      "Help customer",
    );
    await expect(leads.detail(peer, leadId)).rejects.toMatchObject({ status: 404 });
    const otherOrg = (await db.select().from(schema.organizations)).find((o) => o.id !== org)!;
    await expect(
      service.savePolicy(creator, {
        organizationId: otherOrg.id,
        code: "service",
        name: "Service",
        active: true,
        attachmentRequired: true,
        slaHours: 24,
        version: 1,
        notes: "Unauthorized edit",
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("supports project intake, SQL filtering and bounded pagination", async () => {
    const t = await service.create(creator, {
      ...input(),
      kind: "project",
      id: projectId,
      priority: "urgent",
    });
    expect(t.leadId).toBeNull();
    expect(t.customerId).toBe((await service.detail(creator, ticketId)).ticket.customerId);
    const list = await service.list(admin, {
      q: t.number,
      priority: "urgent",
      organizationId: org,
      centreId: centre,
      tab: "all",
    });
    expect(list.total).toBe(1);
    expect(list.rows[0].id).toBe(t.id);
    expect((await service.list(admin, { q: "__doesnotmatch__" })).total).toBe(0);
    expect((await service.list(creator, { page: 2 })).rows).toHaveLength(0);
    expect((await service.list(creator, { resolver: secondId, status: "closed" })).total).toBe(1);
  });
  it("requires independently authorized confirmation for self-assignment", async () => {
    const adminAccess = await service.directory(admin),
      t = await service.create(admin, { ...input(), assignedTo: adminAccess.currentUser.id });
    await change(admin, t.id, "resolve", "Administrator completed the repair");
    await expect(change(admin, t.id, "close")).rejects.toMatchObject({ status: 403 });
    await change(
      independentAdmin,
      t.id,
      "close",
      "Independent administrator confirmed customer acceptance",
    );
    expect((await service.detail(admin, t.id)).ticket.status).toBe("closed");
  });
  it("lists every employee's clients for Help only, including normalized mobile search", async () => {
    const current = (await leads.detail(creator, leadId)).lead;
    expect((await service.directory(peer)).clients.some((x) => x.id === current.customerId)).toBe(
      true,
    );
    expect(
      (
        await service.sources(peer, { kind: "customer", organizationId: org, q: "+91 98765 99991" })
      ).some((x) => x.id === current.customerId),
    ).toBe(true);
    await expect(leads.detail(peer, leadId)).rejects.toMatchObject({ status: 404 });
    const intake = await service.intake(creator, org);
    expect(intake.employees.map((x) => x.id)).toContain(peerId);
    expect(intake.employees.map((x) => x.id)).toContain(accountsId);
    expect(await service.sources(peer, { kind: "customer", q: "%_" })).toHaveLength(0);
  });
  it("persists typed location and customer-only tickets; any named active employee can resolve only their assigned ticket", async () => {
    const [c] = await db
      .insert(schema.customers)
      .values({
        organizationId: org,
        name: "Shared client without project",
        mobile: "+919876511110",
        centreId: null,
      })
      .returning();
    const ctx = await service.context(creator, { kind: "customer", id: c.id });
    expect(ctx.related).toHaveLength(0);
    const t = await service.create(creator, {
      ...input(),
      kind: "customer",
      id: c.id,
      assignedTo: accountsId,
      location: "New Delhi - customer service desk",
    });
    expect(t.leadId).toBeNull();
    expect(t.projectId).toBeNull();
    expect((await service.detail(accounts, t.id)).info.location).toBe(
      "New Delhi - customer service desk",
    );
    expect((await service.list(accounts, {})).total).toBe(1);
    const [legacy] = await db
      .insert(schema.helpTickets)
      .values({
        ...t,
        id: randomUUID(),
        number: `HT-LEGACY-${randomUUID()}`,
        requestId: randomUUID(),
        assignedTo: peerId,
        location: null,
      })
      .returning();
    expect(legacy.location).toBe(ctx.source.location);
    await expect(service.detail(accounts, ticketId)).rejects.toMatchObject({ status: 404 });
    expect(await service.sources(accounts, {})).toHaveLength(0);
    expect((await notifications.list(accounts)).rows.some((x) => x.entity_id === t.id)).toBe(true);
    const proof = await service.prepareFile(accounts, {
      ticketId: t.id,
      name: "resolution.png",
      contentType: "image/png",
      size: 8,
    });
    await service.finalizeFile(accounts, proof.id);
    await change(
      accounts,
      t.id,
      "resolve",
      "Accounts employee resolved the assigned customer query",
      { fileId: proof.id },
    );
    await change(creator, t.id, "close", "Customer confirms resolution");
    await expect(
      db.execute(
        sql`update help_tickets set location='changed',version=version+1 where id=${t.id}::uuid`,
      ),
    ).rejects.toThrow();
    await expect(service.create(creator, { ...input(), location: " " })).rejects.toThrow();
    await expect(service.create(creator, { ...input(), createdBy: peerId })).rejects.toThrow();
  });
  it("uses one general help implementation for all three canonical companies", async () => {
    const orgs = await db.select().from(schema.organizations),
      adminAccess = await service.directory(admin);
    expect(orgs.map((x) => x.name).sort()).toEqual(["Finesta Home", "IBAX", "S-Grip"].sort());
    for (const [n, o] of orgs.entries()) {
      const [c] = await db
        .select()
        .from(schema.centres)
        .where(eq(schema.centres.organizationId, o.id));
      const lead = await leads.create(
        admin,
        leadFormSchema.parse({
          organizationId: o.id,
          centreId: c.id,
          assignedTo: adminAccess.currentUser.id,
          clientName: `Company help ${o.name}`,
          mobile: `98765990${String(n).padStart(2, "0")}`,
          projectName: `Company site ${o.name}`,
          siteAddress: "Isolated shared workflow project",
        }),
      );
      const t = await service.create(admin, {
        ...input(),
        id: lead.id,
        assignedTo: adminAccess.currentUser.id,
      });
      expect(t.organizationId).toBe(o.id);
      expect(t.status).toBe("raised");
      if (o.id !== org)
        await expect(service.context(creator, { kind: "lead", id: lead.id })).rejects.toMatchObject(
          { status: 404 },
        );
    }
  });
  it("snapshots Admin attachment requirements and SLA, verifies private bytes and claims once", async () => {
    await service.savePolicy(admin, {
      organizationId: org,
      code: "service",
      name: "Service",
      active: true,
      attachmentRequired: true,
      slaHours: 24,
      version: 1,
      notes: "Require proof and a one day SLA",
    });
    await expect(service.create(creator, input())).rejects.toMatchObject({ status: 400 });
    const lease = await service.prepareFile(creator, {
      name: "site.png",
      contentType: "image/png",
      size: 8,
      source: { kind: "lead", id: leadId },
    });
    await expect(service.finalizeFile(peer, lease.id)).rejects.toMatchObject({ status: 404 });
    await service.finalizeFile(creator, lease.id);
    const t = await service.create(creator, { ...input(), fileId: lease.id });
    expect(t.dueAt!.getTime()).toBeGreaterThan(Date.now() + 23 * 3600000);
    expect(t.attachmentRequired).toBe(true);
    expect((await service.detail(resolver, t.id)).files).toHaveLength(1);
    expect((await service.download(resolver, lease.id)).url).toContain("private");
    await expect(service.download(peer, lease.id)).rejects.toMatchObject({ status: 404 });
    await expect(service.create(creator, { ...input(), fileId: lease.id })).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      db.execute(sql`update help_ticket_files set name='edited' where id=${lease.id}::uuid`),
    ).rejects.toThrow();
  });
  it("rejects invalid signatures, unfinished uploads and source mismatch without creating tickets", async () => {
    const lease = await service.prepareFile(creator, {
      name: "fake.pdf",
      contentType: "application/pdf",
      size: 8,
      source: { kind: "lead", id: leadId },
    });
    await expect(service.finalizeFile(creator, lease.id)).rejects.toMatchObject({ status: 400 });
    await expect(service.create(creator, { ...input(), fileId: lease.id })).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      service.prepareFile(creator, {
        name: "huge.pdf",
        contentType: "application/pdf",
        size: 10485761,
        source: { kind: "lead", id: leadId },
      }),
    ).rejects.toThrow();
    const good = await service.prepareFile(creator, {
      name: "project.png",
      contentType: "image/png",
      size: 8,
      source: { kind: "project", id: projectId },
    });
    await service.finalizeFile(creator, good.id);
    await expect(service.create(creator, { ...input(), fileId: good.id })).rejects.toMatchObject({
      status: 409,
    });
  });
  it("enforces revoked current permissions, SQL evidence guards and immutable history", async () => {
    // Later source relinking must not invalidate the ticket's original context/history.
    await db.update(schema.leads).set({ projectId: null }).where(eq(schema.leads.id, leadId));
    await change(
      creator,
      ticketId,
      "reopen",
      "Customer requested another check after project relinking",
    );
    await change(secondResolver, ticketId, "resolve", "Completed the original site concern");
    expect((await service.detail(creator, ticketId)).ticket.projectId).toBe(projectId);
    await db.update(schema.leads).set({ projectId }).where(eq(schema.leads.id, leadId));
    await expect(db.execute(sql`update help_ticket_events set notes='tampered'`)).rejects.toThrow();
    await expect(
      db.execute(
        sql`update help_tickets set status='closed',version=version+1 where status='raised'`,
      ),
    ).rejects.toThrow();
    await db
      .delete(schema.rolePermissions)
      .where(
        and(
          eq(schema.rolePermissions.organizationId, org),
          eq(schema.rolePermissions.role, "Service Engineer"),
          eq(schema.rolePermissions.permission, "help.read"),
        ),
      );
    // Named-ticket access is independent of broad role grants, but never survives
    // employee deactivation or loss of the company assignment.
    await db
      .update(schema.employeeProfiles)
      .set({ active: false })
      .where(eq(schema.employeeProfiles.userId, resolverId));
    await expect(service.list(resolver, {})).rejects.toMatchObject({ status: 403 });
    await expect(notifications.list(resolver)).rejects.toMatchObject({ status: 403 });
    await expect(service.detail(resolver, ticketId)).rejects.toMatchObject({ status: 403 });
  });
});
