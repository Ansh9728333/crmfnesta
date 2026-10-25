import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import * as schema from "../../src/lib/db/schema";
import type { Database } from "../../src/lib/db";
import { buildAuth } from "../../src/lib/auth/config";
import { bootstrapAdmin } from "../../src/lib/auth/bootstrap";
import { changeEmployeePassword } from "../../src/lib/auth/password";
import { employeeService } from "../../src/lib/employees/service";
import { leadService } from "../../src/lib/leads/service";
import { leadFormSchema, type LeadInput } from "../../src/lib/leads/validation";
import { presalesService, type FileStore } from "../../src/lib/presales/service";
import { quotationPdf } from "../../src/lib/presales/pdf";
import { PDFDocument } from "pdf-lib";
import { mkdir, writeFile } from "node:fs/promises";

const pg = new PGlite(),
  db = drizzle(pg, { schema }) as unknown as Database,
  settings = {
    url: "http://localhost:3000",
    secret: randomUUID() + randomUUID(),
    rateLimit: false,
  },
  auth = buildAuth(db, settings),
  people = employeeService(db, settings),
  service = leadService(db, settings),
  workflow = presalesService(db, settings),
  password = `Initial-${randomUUID()}`,
  changed = `Changed-${randomUUID()}`;
let admin: Headers,
  a: Headers,
  b: Headers,
  cse: Headers,
  manager: Headers,
  otherBranch: Headers,
  orgs: (typeof schema.organizations.$inferSelect)[] = [],
  centres: (typeof schema.centres.$inferSelect)[] = [],
  leadId = "",
  secondId = "";
const ids: Record<string, string> = {};
const cookies = (response: Response) =>
  new Headers({
    origin: settings.url,
    cookie: response.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; "),
  });
async function signIn(username: string) {
  const response = await auth.api.signInUsername({
    body: { username, password },
    asResponse: true,
  });
  return cookies(
    await changeEmployeePassword(db, settings, cookies(response), {
      currentPassword: password,
      newPassword: changed,
    }),
  );
}
function input(overrides: Partial<LeadInput> = {}): LeadInput {
  return leadFormSchema.parse({
    organizationId: orgs[0].id,
    centreId: centres.find((c) => c.organizationId === orgs[0].id && c.name === "Main")!.id,
    assignedTo: ids.a,
    clientName: "Integration Customer",
    mobile: "9876543201",
    projectName: "Integration Villa",
    siteAddress: "Test address Bengaluru 560001",
    expectedValue: "125000.25",
    financialYear: "2026-27",
    bookingMonth: 10,
    brand: "Test brand",
    source: "Website",
    priority: "high",
    territory: "Bengaluru",
    ...overrides,
  });
}
beforeAll(async () => {
  await pg.exec("create role anon; create role authenticated;");
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" }))
    for (const statement of migration.sql) await pg.exec(statement);
  await bootstrapAdmin(db, settings, {
    name: "Pre-sales Test Admin",
    email: "presales-admin@example.test",
    username: "presales.admin",
    password,
    mobile: "+919000000001",
    centre: "Main",
  });
  admin = await signIn("presales.admin");
  orgs = await db.select().from(schema.organizations).orderBy(schema.organizations.slug);
  centres = await db.select().from(schema.centres);
  const branch = (
    await people.createCentre(admin, { organizationId: orgs[0].id, name: "Other branch" })
  ).id;
  for (const [key, role, centre] of [
    ["a", "Sales Executive", centres.find((c) => c.organizationId === orgs[0].id)!.id],
    ["b", "Sales Executive", centres.find((c) => c.organizationId === orgs[0].id)!.id],
    ["cse", "CSE", centres.find((c) => c.organizationId === orgs[0].id)!.id],
    ["manager", "Sales Manager", centres.find((c) => c.organizationId === orgs[0].id)!.id],
    ["branch", "Sales Executive", branch],
  ]) {
    ids[key] = (
      await people.create(admin, {
        name: `Test ${key}`,
        username: `presales.${key}`,
        email: `presales-${key}@example.test`,
        password,
        mobile: "+919000000002",
        department: "Sales",
        active: true,
        assignments: [{ organizationId: orgs[0].id, centreId: centre, role }],
      })
    ).id;
    const h = await signIn(`presales.${key}`);
    if (key === "a") a = h;
    else if (key === "b") b = h;
    else if (key === "cse") cse = h;
    else if (key === "manager") manager = h;
    else otherBranch = h;
  }
});
afterAll(async () => {
  await pg.close();
});
describe("persisted common pre-sales workflow", () => {
  it("creates a lead, real customer/project and immutable activity atomically", async () => {
    leadId = (await service.create(a, input({ cseId: ids.cse }))).id;
    const detail = await service.detail(a, leadId);
    expect(detail.lead.mobile).toBe("+919876543201");
    expect(detail.lead.finalisedValue).toBeNull();
    expect(detail.lead.stage).toBe(1);
    expect(detail.activities[0].kind).toBe("created");
    expect((await service.customers(a, {})).total).toBe(1);
    expect((await service.projects(a, {})).total).toBe(1);
    expect((await leadService(db, settings).detail(a, leadId)).lead.projectName).toBe(
      "Integration Villa",
    );
    await expect(db.execute(sql`update lead_activities set summary='tampered'`)).rejects.toThrow();
  });
  it("denies other employees, branches and organizations", async () => {
    await expect(service.detail(b, leadId)).rejects.toMatchObject({ status: 404 });
    expect((await service.list(otherBranch, {})).total).toBe(0);
    expect((await service.customers(b, {})).total).toBe(0);
    expect((await service.projects(b, {})).total).toBe(0);
    await expect(
      service.create(
        a,
        input({
          organizationId: orgs[1].id,
          centreId: centres.find((c) => c.organizationId === orgs[1].id)!.id,
        }),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("detects normalized-mobile duplicates and links multiple projects to one customer", async () => {
    await expect(
      service.create(a, input({ mobile: "+91 98765 43201", projectName: "Second Villa" })),
    ).rejects.toMatchObject({ status: 409 });
    const old = (await service.detail(a, leadId)).lead;
    secondId = (
      await service.create(
        a,
        input({
          customerId: old.customerId,
          projectName: "Second Villa",
          duplicateAcknowledged: true,
          duplicateReason: "Same customer, separate site",
        }),
      )
    ).id;
    expect((await service.customers(a, {})).total).toBe(1);
    expect((await service.projects(a, { customerId: old.customerId })).total).toBe(2);
    expect((await service.list(a, { customerId: old.customerId })).total).toBe(2);
  });
  it("edits every requested field and rejects stale saves", async () => {
    const detail = await service.detail(a, leadId);
    const data = input({
      customerId: detail.lead.customerId,
      projectId: detail.lead.projectId!,
      cseId: ids.cse,
      soe: "Architect",
      customerType: "Individual",
      buildingType: "Villa",
      orderType: "New build",
      orderQty: "12.500",
      pleatedMeshQty: "2.000",
      material: "uPVC",
      discountOffered: "5%",
      remarks: "Detailed follow-up remarks",
      finalisedValue: "",
      expectedValue: "130000.50",
    });
    await service.update(a, leadId, { version: detail.lead.version, data });
    const result = await service.detail(a, leadId);
    expect(result.lead.expectedValue).toBe("130000.50");
    expect(result.lead.material).toBe("uPVC");
    expect(result.lead.discountOffered).toBe("5%");
    expect(result.activities[0].changes.remarks.after).toBe("Detailed follow-up remarks");
    await expect(
      service.update(a, leadId, { version: detail.lead.version, data }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("tracks multiple follow-ups, completion and the earliest pending next action", async () => {
    let detail = await service.detail(a, leadId);
    await service.addFollowUp(a, leadId, {
      version: detail.lead.version,
      dueAt: "2020-01-01T10:00:00+05:30",
      action: "Overdue call",
    });
    detail = await service.detail(a, leadId);
    await service.addFollowUp(a, leadId, {
      version: detail.lead.version,
      dueAt: "2090-01-01T10:00:00+05:30",
      action: "Future survey",
    });
    detail = await service.detail(a, leadId);
    expect(detail.lead.nextAction).toBe("Overdue call");
    expect((await service.list(a, { followUp: "overdue" })).rows.some((r) => r.id === leadId)).toBe(
      true,
    );
    const follow = detail.followUps.find((f) => f.action === "Overdue call")!;
    await service.completeFollowUp(a, leadId, follow.id, {
      version: detail.lead.version,
      notes: "Spoke with customer",
    });
    detail = await service.detail(a, leadId);
    expect(detail.lead.nextAction).toBe("Future survey");
    expect(detail.activities.some((a) => a.kind === "follow-up-completed")).toBe(true);
  });
  it("reschedules the next follow-up while preserving other planned work", async () => {
    let detail = await service.detail(a, leadId);
    await service.addFollowUp(a, leadId, {
      version: detail.lead.version,
      dueAt: "2092-01-01T10:00:00+05:30",
      action: "Later project review",
    });
    detail = await service.detail(a, leadId);
    await service.update(a, leadId, {
      version: detail.lead.version,
      data: input({
        customerId: detail.lead.customerId,
        projectId: detail.lead.projectId!,
        nextFollowUp: "2091-01-01T10:00:00+05:30",
        nextAction: "Rescheduled survey",
      }),
    });
    detail = await service.detail(a, leadId);
    expect(detail.lead.nextAction).toBe("Rescheduled survey");
    expect(detail.followUps.find((f) => f.action === "Future survey")?.state).toBe("cancelled");
    expect(detail.followUps.find((f) => f.action === "Later project review")?.state).toBe(
      "pending",
    );
    expect(detail.followUps.filter((f) => f.state === "pending")).toHaveLength(2);
  });
  it("records appointment changes, measurements, private attachments and history", async () => {
    const scheduled = {
      assignedTo: ids.a,
      scheduledAt: "2090-01-01T10:00:00+05:30",
      status: "scheduled",
      observations: "",
      measurements: [],
    };
    const visit = await workflow.appointment(a, leadId, scheduled);
    expect((await service.detail(a, leadId)).lead.stage).toBe(2);
    await workflow.appointment(a, leadId, {
      ...scheduled,
      id: visit.id,
      version: 1,
      status: "completed",
      observations: "Opening ready for measurement",
      measurements: [{ label: "Window width", value: "1500", unit: "mm" }],
    });
    expect((await service.detail(a, leadId)).lead.stage).toBe(3);
    await expect(
      workflow.appointment(a, leadId, { ...scheduled, id: visit.id, version: 1 }),
    ).rejects.toMatchObject({ status: 409 });
    const objects = new Map<string, Uint8Array>(),
      store: FileStore = {
        async upload(path, bytes) {
          objects.set(path, bytes);
        },
        async remove(path) {
          objects.delete(path);
        },
        async sign(path) {
          if (!objects.has(path)) throw new Error("Missing object");
          return "https://storage.example.test/private";
        },
      };
    await expect(
      workflow.upload(
        b,
        leadId,
        {
          name: "site.png",
          contentType: "image/png",
          bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        },
        store,
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(objects.size).toBe(0);
    const file = await workflow.upload(
      a,
      leadId,
      {
        name: "site.png",
        contentType: "image/png",
        bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        appointmentId: visit.id,
      },
      store,
    );
    expect((await workflow.download(a, leadId, file.id, store)).expiresIn).toBe(60);
    await expect(workflow.download(b, leadId, file.id, store)).rejects.toMatchObject({
      status: 404,
    });
    const detail = await workflow.detail(a, leadId);
    expect(detail.visits[0].measurements[0].value).toBe("1500");
    expect(detail.files[0].appointmentId).toBe(visit.id);
    await expect(
      db
        .insert(schema.presalesAttachments)
        .values({
          organizationId: orgs[0].id,
          leadId: secondId,
          appointmentId: visit.id,
          name: "Wrong lead.png",
          objectPath: "isolated-invalid-test-path",
          contentType: "image/png",
          byteSize: 8,
          uploadedBy: ids.a,
        }),
    ).rejects.toThrow();
    expect((await workflow.list(admin, "appointments", { q: "Integration" })).total).toBe(1);
  });
  it("enforces assignment authority and revokes the former owner's record access", async () => {
    let detail = await service.detail(a, leadId);
    const data = input({
      customerId: detail.lead.customerId,
      projectId: detail.lead.projectId!,
      assignedTo: ids.b,
      remarks: "Reassigned by coordinator",
      stage: detail.lead.stage,
      nextFollowUp: detail.lead.nextFollowUp!.toISOString(),
      nextAction: detail.lead.nextAction!,
    });
    await expect(
      service.update(a, leadId, { version: detail.lead.version, data }),
    ).rejects.toMatchObject({ status: 403 });
    await service.update(cse, leadId, { version: detail.lead.version, data });
    detail = await service.detail(b, leadId);
    expect(detail.lead.assignedTo).toBe(ids.b);
    expect(
      detail.followUps.filter((f) => f.state === "pending").every((f) => f.assignedTo === ids.b),
    ).toBe(true);
    await expect(service.detail(a, leadId)).rejects.toMatchObject({ status: 404 });
    const projectsA = await service.projects(a, {});
    expect(projectsA.rows.some((p) => p.id === detail.lead.projectId)).toBe(false);
    expect((await service.detail(manager, leadId)).canAssign).toBe(true);
  });
  it("requires a Lost reason, retains history and cancels remaining tasks", async () => {
    let detail = await service.detail(b, leadId);
    const data = input({
      customerId: detail.lead.customerId,
      projectId: detail.lead.projectId!,
      assignedTo: ids.b,
    });
    data.stage = 7;
    data.outcome = "lost";
    await expect(
      service.update(b, leadId, { version: detail.lead.version, data }),
    ).rejects.toBeDefined();
    await service.update(b, leadId, {
      version: detail.lead.version,
      data: { ...data, lossReason: "Customer deferred construction" },
    });
    detail = await service.detail(b, leadId);
    expect(detail.lead.outcome).toBe("lost");
    expect(detail.lead.closedAt).toBeInstanceOf(Date);
    expect((await workflow.detail(b, leadId)).visits).toHaveLength(1);
    await expect(
      workflow.engagement(b, leadId, {
        kind: "negotiation",
        occurredAt: new Date().toISOString(),
        outcome: "Closed",
        notes: "Should fail",
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(detail.lead.nextFollowUp).toBeNull();
    expect(detail.followUps.every((f) => f.state !== "pending")).toBe(true);
    expect(detail.activities.some((a) => a.summary.includes("Customer deferred"))).toBe(true);
    expect(detail.orderId).toBeNull();
    const closureTime = detail.lead.closedAt!.toISOString();
    await service.update(b, leadId, {
      version: detail.lead.version,
      data: { ...data, lossReason: "Customer deferred construction", remarks: "Closure reviewed" },
    });
    expect((await service.detail(b, leadId)).lead.closedAt!.toISOString()).toBe(closureTime);
  });
  it("preserves quotation revisions and rejects stale versions and unauthorized changes", async () => {
    const inputQuote = {
      expectedRevision: 0,
      items: [
        {
          name: "Window",
          description: "Measured opening",
          productCompanyId: orgs[0].id,
          quantity: "2.5",
          unitPrice: "100.10",
          discount: "10",
        },
      ],
      customerNotes: "Customer requested clear finish",
    };
    const first = await workflow.quotation(a, secondId, inputQuote);
    await workflow.decide(a, secondId, {
      quotationId: first.id,
      decision: "accepted",
      evidence: "Customer confirmed V1 in person",
    });
    await expect(
      workflow.quotation(a, secondId, { ...inputQuote, expectedRevision: 1 }),
    ).rejects.toBeDefined();
    const second = await workflow.quotation(a, secondId, {
      ...inputQuote,
      expectedRevision: 1,
      revisionReason: "Revised measured quantity",
      items: [{ ...inputQuote.items[0], quantity: "3", discount: "20" }],
    });
    expect(second.revision).toBe(2);
    await expect(
      workflow.quotation(a, secondId, {
        ...inputQuote,
        expectedRevision: 1,
        revisionReason: "Stale revision",
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      workflow.decide(a, secondId, {
        quotationId: first.id,
        decision: "approved",
        evidence: "Old version",
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await workflow.quotationDetail(a, secondId, first.id)).amount).toBe("240.25");
    expect((await workflow.quotationDetail(a, secondId, second.id)).amount).toBe("280.30");
    await expect(workflow.quotationDetail(b, secondId, first.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      db.update(schema.quotations).set({ amount: "1" }).where(eq(schema.quotations.id, first.id)),
    ).rejects.toThrow();
    const pdf = await quotationPdf(await workflow.quotationDetail(a, secondId, first.id));
    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(0);
    await mkdir("test-results/pdf", { recursive: true });
    await writeFile("test-results/pdf/quotation-v1.pdf", pdf);
    await expect(
      db
        .update(schema.quotationItems)
        .set({ quantity: "99" })
        .where(eq(schema.quotationItems.quotationId, first.id)),
    ).rejects.toThrow();
    const revisions = await Promise.allSettled(
      ["Confirmed finishing notes", "Concurrent alternate notes"].map((revisionReason) =>
        workflow.quotation(a, secondId, {
          ...inputQuote,
          expectedRevision: 2,
          revisionReason,
          items: [{ ...inputQuote.items[0], quantity: "3", discount: "20" }],
        }),
      ),
    );
    expect(revisions.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(revisions.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect((await workflow.detail(a, secondId)).quotations.map((q) => q.revision)).toEqual([
      3, 2, 1,
    ]);
  });
  it("advances shared stages and converts only an approved latest quotation exactly once", async () => {
    let detail = await service.detail(a, secondId);
    const baseData = input({
      customerId: detail.lead.customerId,
      projectId: detail.lead.projectId!,
      projectName: "Second Villa",
    });
    await expect(
      service.update(a, secondId, {
        version: detail.lead.version,
        data: { ...baseData, stage: 4 },
      }),
    ).rejects.toMatchObject({ status: 400 });
    for (let stage = 2; stage <= 4; stage++) {
      detail = await service.detail(a, secondId);
      await service.update(a, secondId, {
        version: detail.lead.version,
        data: {
          ...baseData,
          stage,
          outcome: "open",
          finalisedValue: "",
        },
      });
    }
    await workflow.engagement(a, secondId, {
      kind: "showroom",
      occurredAt: new Date().toISOString(),
      outcome: "Not Required",
      notRequired: true,
      reason: "Customer viewed finishes on site",
      notes: "Alternative presentation completed",
    });
    await workflow.engagement(a, secondId, {
      kind: "negotiation",
      occurredAt: new Date().toISOString(),
      outcome: "Offer agreed",
      notes: "Confirmed revised quantity",
      offeredValue: "280.30",
    });
    detail = await service.detail(a, secondId);
    expect(detail.lead.stage).toBe(6);
    const quote = (await workflow.detail(a, secondId)).quotations[0],
      conversion = {
        version: detail.lead.version,
        organizationId: orgs[0].id,
        quotationId: quote.id,
        finalValue: "280.30",
        quantitiesConfirmed: true,
      };
    await expect(
      service.update(a, secondId, {
        version: detail.lead.version,
        data: { ...baseData, stage: 7, outcome: "won", finalisedValue: "280.30" },
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(workflow.convert(a, secondId, conversion)).rejects.toMatchObject({ status: 400 });
    await workflow.decide(a, secondId, {
      quotationId: quote.id,
      decision: "accepted",
      evidence: "Customer accepted final item quantities and V2 amount",
    });
    conversion.version = (await service.detail(a, secondId)).lead.version;
    await expect(
      workflow.convert(a, secondId, { ...conversion, organizationId: orgs[1].id }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      workflow.convert(a, secondId, { ...conversion, finalValue: "10" }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      workflow.convert(a, secondId, { ...conversion, quantitiesConfirmed: false }),
    ).rejects.toBeDefined();
    const [one, two] = await Promise.all([
      workflow.convert(a, secondId, conversion),
      workflow.convert(a, secondId, conversion),
    ]);
    expect(one.id).toBe(two.id);
    detail = await service.detail(a, secondId);
    expect(detail.orderId).toBe(one.id);
    expect(detail.lead.closedAt).toBeInstanceOf(Date);
    const converted = await workflow.orderDetail(a, one.id);
    expect(converted.order.finalValue).toBe("280.30");
    expect(converted.order.finalQuantity).toBe("3.000");
    expect(converted.items[0].quantity).toBe("3.000");
    expect(converted.order.stage).toBe(1);
    expect(converted.events[0].toStage).toBe(1);
    expect((await workflow.detail(cse, secondId)).order).toBeNull();
    expect(
      await db.select().from(schema.orders).where(eq(schema.orders.leadId, secondId)),
    ).toHaveLength(1);
  });
  it("creates standalone customers/projects and protects restricted duplicate identities", async () => {
    const customer = await service.createCustomer(a, {
      organizationId: orgs[0].id,
      centreId: input().centreId,
      assignedTo: ids.a,
      name: "Standalone Customer",
      mobile: "9876543299",
      email: "standalone@example.test",
    });
    const project = await service.createProject(a, {
      organizationId: orgs[0].id,
      centreId: input().centreId,
      assignedTo: ids.a,
      customerId: customer.id,
      name: "Standalone Site",
      siteAddress: "Standalone site Bengaluru",
    });
    expect((await service.projects(a, { customerId: customer.id })).rows[0].id).toBe(project.id);
    await expect(
      service.createProject(b, {
        organizationId: orgs[0].id,
        centreId: input().centreId,
        assignedTo: ids.b,
        customerId: customer.id,
        name: "Unauthorized Site",
        siteAddress: "Unauthorized site address",
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.create(
        a,
        input({
          mobile: "9876543201",
          clientName: "Another contact",
          siteAddress: "Another address Bengaluru",
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    // Both matching records are now closed and split between employees. The
    // restricted match must never return the other employee's customer details.
    try {
      await service.create(
        b,
        input({
          assignedTo: ids.b,
          mobile: "9876543201",
          clientName: "Different name",
          siteAddress: "Different address Bengaluru",
        }),
      );
      expect.fail("Expected duplicate warning");
    } catch (error) {
      expect(error).toMatchObject({ restricted: true });
      expect(JSON.stringify(error)).not.toContain(secondId);
    }
  });
  it("uses SQL filtering, stable pagination and independent Kanban stage totals", async () => {
    for (let i = 0; i < 12; i++)
      await service.create(
        admin,
        input({
          clientName: `Pagination ${i}`,
          mobile: `98900000${String(i).padStart(2, "0")}`,
          projectName: `Page project ${i}`,
          source: "Referral",
        }),
      );
    const first = await service.list(admin, { q: "Pagination", pageSize: 5, page: 1 }),
      second = await service.list(admin, { q: "Pagination", pageSize: 5, page: 2 });
    expect(first.total).toBe(12);
    expect(first.rows).toHaveLength(5);
    expect(new Set([...first.rows, ...second.rows].map((r) => r.id)).size).toBe(10);
    expect(
      (
        await service.list(admin, {
          source: "Referral",
          priority: "high",
          financialYear: "2026-27",
        })
      ).total,
    ).toBe(12);
    const board = await service.board(admin, { source: "Referral" });
    expect(board[0].total).toBe(12);
    expect(board[0].rows).toHaveLength(10);
    expect((await service.list(admin, { q: "%' OR 1=1 --" })).total).toBe(0);
  });
  it("archives/restores without deleting history and keeps permission changes current", async () => {
    let detail = await service.detail(manager, leadId);
    await service.archive(manager, leadId, {
      version: detail.lead.version,
      reason: "Duplicate site enquiry",
    });
    expect((await service.list(b, { archived: "yes" })).rows.some((r) => r.id === leadId)).toBe(
      true,
    );
    detail = await service.detail(manager, leadId);
    await service.archive(manager, leadId, {
      version: detail.lead.version,
      reason: "Customer requested record",
      restore: true,
    });
    await people.updatePermissions(admin, {
      organizationId: orgs[0].id,
      role: "Sales Executive",
      permissions: [],
    });
    await expect(service.list(a, {})).rejects.toMatchObject({ status: 403 });
  });
  it("denies public access to new tables and rejects cross-company parent links", async () => {
    await pg.exec("SET ROLE anon");
    try {
      await expect(pg.query("SELECT * FROM lead_activities")).rejects.toThrow();
      await expect(pg.query("SELECT * FROM lead_follow_ups")).rejects.toThrow();
      await expect(pg.query("SELECT * FROM quotation_decisions")).rejects.toThrow();
      await expect(pg.query("SELECT * FROM sales_engagements")).rejects.toThrow();
      await expect(pg.query("SELECT * FROM presales_attachments")).rejects.toThrow();
    } finally {
      await pg.exec("RESET ROLE");
    }
    await expect(
      db.insert(schema.projects).values({
        organizationId: orgs[1].id,
        centreId: centres.find((c) => c.organizationId === orgs[0].id)!.id,
        customerId: (await service.detail(admin, leadId)).lead.customerId,
        name: "Invalid parent",
      }),
    ).rejects.toThrow();
    expect(
      await db
        .select()
        .from(schema.leadActivities)
        .where(
          and(eq(schema.leadActivities.leadId, leadId), eq(schema.leadActivities.kind, "assigned")),
        ),
    ).toHaveLength(1);
  });
});
