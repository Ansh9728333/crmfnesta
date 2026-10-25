import { managementService } from "../../src/lib/management/service";
import { settingsService } from "../../src/lib/management/settings";
import { notificationService } from "../../src/lib/management/notifications";
import { reports } from "../../src/lib/management/validation";
import Decimal from "decimal.js";
import ExcelJS from "exceljs";
import { aftercareService } from "../../src/lib/aftercare/service";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
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
import { resolveAccess } from "../../src/lib/auth/access";
import { employeeService } from "../../src/lib/employees/service";
import { leadService } from "../../src/lib/leads/service";
import { presalesService, type FileStore } from "../../src/lib/presales/service";
import { leadFormSchema } from "../../src/lib/leads/validation";
import { orderService } from "../../src/lib/orders/service";
import { stageDefinition, stageDefinitions } from "../../src/lib/orders/definitions";
import { stageData } from "../support/post-sales-data";
import { productionService } from "../../src/lib/production/service";
import { exerciseCommerce } from "../support/commerce-scenario";
import { commerceService } from "../../src/lib/commerce/service";
import { exerciseInstallation, exerciseHandover } from "../support/aftercare-scenario";
const pg = new PGlite(),
  db = drizzle(pg, { schema }) as unknown as Database,
  settings = {
    url: "http://localhost:3000",
    secret: randomUUID() + randomUUID(),
    rateLimit: false,
  },
  auth = buildAuth(db, settings),
  employees = employeeService(db, settings),
  leads = leadService(db, settings),
  presales = presalesService(db, settings),
  service = orderService(db, settings),
  production = productionService(db, settings),
  password = `Initial-${randomUUID()}`,
  changed = `Changed-${randomUUID()}`;
let admin: Headers,
  sales: Headers,
  coordinator: Headers,
  accounts: Headers,
  installer: Headers,
  manager: Headers,
  localAdmin: Headers,
  engineer: Headers,
  outsider: Headers,
  adminId = "",
  salesId = "",
  coordinatorId = "",
  accountsId = "",
  installerId = "",
  engineerId = "";
let orgs: (typeof schema.organizations.$inferSelect)[] = [],
  centres: (typeof schema.centres.$inferSelect)[] = [];
const orderIds: string[] = [],
  objects = new Map<string, Uint8Array>(),
  png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
let signCalls = 0;
const store: FileStore = {
  async upload(path, bytes) {
    objects.set(path, bytes);
  },
  async remove(path) {
    objects.delete(path);
  },
  async sign(path) {
    signCalls++;
    if (!objects.has(path)) throw new Error("Object missing");
    return "https://storage.example.test/signed-local-fixture";
  },
};
const cookies = (response: Response) =>
  new Headers({
    origin: settings.url,
    cookie: response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; "),
  });
async function login(username: string) {
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
async function stage(id: string, number: number) {
  return (await service.detail(admin, id, { fileStage: number })).stages.find(
    (s) => s.number === number,
  )!;
}
async function command(
  id: string,
  number: number,
  action: string,
  data: Record<string, unknown> = {},
  headers = admin,
) {
  const current = await stage(id, number);
  return service.transition(headers, id, number, { action, version: current.version, ...data });
}
beforeAll(async () => {
  await pg.exec("create role anon; create role authenticated;");
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" }))
    for (const statement of migration.sql) await pg.exec(statement);
  await bootstrapAdmin(db, settings, {
    name: "Post-sales test admin",
    email: "orders-admin@example.test",
    username: "orders.admin",
    password,
    mobile: "9000000001",
    centre: "Main",
  });
  admin = await login("orders.admin");
  adminId = (await resolveAccess(db, auth, admin)).user.id;
  orgs = await db.select().from(schema.organizations).orderBy(schema.organizations.slug);
  centres = await db.select().from(schema.centres);
  for (const [key, role, index] of [
    ["sales", "Sales Executive", 0],
    ["coordinator", "Post-Sales Coordinator", 0],
    ["outsider", "Sales Executive", 1],
    ["accounts", "Accounts", 0],
    ["installer", "Installation Team", 0],
    ["engineer", "Service Engineer", 0],
    ["manager", "Sales Manager", 0],
    ["localadmin", "Admin", 0],
  ] as const) {
    const created = await employees.create(admin, {
      name: `Order test ${key}`,
      username: `orders.${key}`,
      email: `orders-${key}@example.test`,
      password,
      mobile: "9000000002",
      department: "Operations",
      active: true,
      assignments: [
        {
          organizationId: orgs[index].id,
          centreId: centres.find((c) => c.organizationId === orgs[index].id)!.id,
          role,
        },
      ],
    });
    const h = await login(`orders.${key}`);
    if (key === "sales") {
      sales = h;
      salesId = created.id;
    } else if (key === "coordinator") {
      coordinator = h;
      coordinatorId = created.id;
    } else if (key === "accounts") {
      accounts = h;
      accountsId = created.id;
    } else if (key === "installer") {
      installer = h;
      installerId = created.id;
    } else if (key === "engineer") {
      engineer = h;
      engineerId = created.id;
    } else if (key === "manager") {
      manager = h;
    } else if (key === "localadmin") {
      localAdmin = h;
    } else outsider = h;
  }
  for (const [index, org] of orgs.entries()) {
    const input = leadFormSchema.parse({
        organizationId: org.id,
        centreId: centres.find((c) => c.organizationId === org.id)!.id,
        assignedTo: index === 0 ? salesId : adminId,
        clientName: `Post-sales ${org.name}`,
        mobile: `987670000${index}`,
        projectName: `Post-sales site ${index}`,
        siteAddress: "Isolated integration site Bengaluru",
      }),
      lead = await leads.create(admin, input);
    for (let number = 2; number <= 6; number++) {
      const detail = await leads.detail(admin, lead.id);
      await leads.update(admin, lead.id, {
        version: detail.lead.version,
        data: {
          ...input,
          customerId: detail.lead.customerId,
          projectId: detail.lead.projectId,
          stage: number,
        },
      });
    }
    const quote = await presales.quotation(admin, lead.id, {
      expectedRevision: 0,
      items: [
        {
          name: "Contract product",
          description: "Isolated item",
          productCompanyId: org.id,
          quantity: "40",
          unitPrice: "2.50",
          discount: "0",
        },
      ],
    });
    await presales.decide(admin, lead.id, {
      quotationId: quote.id,
      decision: "accepted",
      evidence: "Isolated customer acceptance",
    });
    const detail = await leads.detail(admin, lead.id);
    orderIds.push(
      (
        await presales.convert(admin, lead.id, {
          version: detail.lead.version,
          organizationId: org.id,
          quotationId: quote.id,
          finalValue: "100",
          quantitiesConfirmed: true,
        })
      ).id,
    );
  }
});
afterAll(async () => pg.close());
describe("shared post-sales workflow", () => {
  it("initializes the same sixteen pending stages only after real Won conversion", async () => {
    for (const id of orderIds) {
      const detail = await service.detail(admin, id);
      expect(detail.stages.map((s) => s.name)).toEqual(stageDefinitions.map((s) => s.name));
      expect(
        detail.stages.every((s) => s.status === "pending" && !s.completedAt && !s.approvedBy),
      ).toBe(true);
      expect(detail.order.completedAt).toBeNull();
      expect(detail.stages).toHaveLength(16);
    }
    await service.initialize(admin, orderIds[0]);
    expect((await service.detail(admin, orderIds[0])).stages).toHaveLength(16);
  });
  it("rejects unconverted/legacy orders and unauthorized skipping", async () => {
    const original = (await service.detail(admin, orderIds[2])).order,
      open = await leads.create(
        admin,
        leadFormSchema.parse({
          organizationId: original.organizationId,
          centreId: original.centreId,
          assignedTo: adminId,
          clientName: "Unconverted enquiry",
          mobile: "9876700099",
          projectName: "Unconverted site",
          siteAddress: "Other isolated Bengaluru address",
        }),
      ),
      lead = (await leads.detail(admin, open.id)).lead,
      [order] = await db
        .insert(schema.orders)
        .values({
          organizationId: lead.organizationId,
          leadId: lead.id,
          customerId: lead.customerId,
          centreId: lead.centreId,
          assignedTo: adminId,
        })
        .returning();
    await expect(service.initialize(admin, order.id)).rejects.toMatchObject({ status: 404 });
    await expect(service.detail(outsider, orderIds[0])).rejects.toMatchObject({ status: 404 });
    await expect(
      command(
        orderIds[0],
        1,
        "plan",
        { assignedTo: salesId, plannedAt: "2020-01-01T10:00:00Z" },
        sales,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(command(orderIds[0], 2, "start")).rejects.toMatchObject({ status: 409 });
    await expect(command(orderIds[0], 1, "approve")).rejects.toMatchObject({ status: 409 });
    await expect(service.configuration(sales)).rejects.toMatchObject({ status: 403 });
    await expect(service.list(new Headers())).rejects.toMatchObject({ status: 401 });
    await expect(commerceService(db, settings).detail(outsider, orderIds[0])).rejects.toMatchObject(
      { status: 404 },
    );
    await expect(commerceService(db, settings).list(sales, "payments")).rejects.toMatchObject({
      status: 403,
    });
  });
  it("audits company policies, preserves core rules and snapshots pending responsibilities", async () => {
    const def = stageDefinition(6);
    await expect(
      service.configure(admin, {
        organizationId: orgs[0].id,
        number: 1,
        version: 0,
        ownerRole: "Post-Sales Coordinator",
        approverRole: "Sales Manager",
        requiredFields: ["notes"],
      }),
    ).rejects.toMatchObject({ status: 400 });
    await service.configure(admin, {
      organizationId: orgs[0].id,
      number: 6,
      version: 0,
      ownerRole: "Post-Sales Coordinator",
      approverRole: "Production Coordinator",
      requiredFields: def.requiredFields,
      applyToPending: true,
    });
    expect((await stage(orderIds[0], 6)).ownerRole).toBe("Post-Sales Coordinator");
    expect((await stage(orderIds[1], 6)).ownerRole).toBe("Production Coordinator");
    await expect(
      service.configure(admin, {
        organizationId: orgs[0].id,
        number: 6,
        version: 0,
        ownerRole: "Post-Sales Coordinator",
        approverRole: "Production Coordinator",
        requiredFields: def.requiredFields,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await service.configure(admin, {
      organizationId: orgs[0].id,
      number: 3,
      version: 0,
      ownerRole: "Survey Engineer",
      approverRole: "Sales Manager",
      requiredFields: [...stageDefinition(3).requiredFields, "attachments"],
      applyToPending: true,
    });
    expect((await stage(orderIds[0], 3)).requiredFields).toContain("attachments");
  });
  it("allows only assigned active specialists to write and enforces current grants", async () => {
    const id = orderIds[0];
    await command(id, 1, "plan", { assignedTo: coordinatorId, plannedAt: "2020-01-01T10:00:00Z" });
    await command(id, 1, "start", {}, coordinator);
    const current = await stage(id, 1);
    await expect(
      service.transition(sales, id, 1, {
        action: "save",
        version: current.version,
        data: stageData(1),
        notes: "Unauthorized edit",
      }),
    ).rejects.toMatchObject({ status: 403 });
    await command(
      id,
      1,
      "save",
      { data: stageData(1), notes: "Group details recorded manually" },
      coordinator,
    );
    await db
      .delete(schema.rolePermissions)
      .where(
        and(
          eq(schema.rolePermissions.organizationId, orgs[0].id),
          eq(schema.rolePermissions.role, "Post-Sales Coordinator"),
          eq(schema.rolePermissions.permission, "orders.manage"),
        ),
      );
    await expect(
      command(id, 1, "save", { data: stageData(1), notes: "Revoked access" }, coordinator),
    ).rejects.toMatchObject({ status: 403 });
    await db.insert(schema.rolePermissions).values({
      organizationId: orgs[0].id,
      role: "Post-Sales Coordinator",
      permission: "orders.manage",
    });
    const dashboard = await service.list(admin, { organizationId: orgs[0].id, status: "overdue" });
    expect(dashboard.rows.some((r) => r.id === id)).toBe(true);
    expect((await service.list(outsider, {})).rows.some((r) => r.id === id)).toBe(false);
  });
  for (let company = 0; company < 3; company++)
    it(`allocates 40 confirmed items as 30 ready and 10 pending for company ${company + 1}`, async () => {
      const orderId = orderIds[company],
        item = (await production.planning(admin, orderId)).items[0];
      const plan = {
        orderId,
        assignedTo: adminId,
        siteReady: true,
        notes: "First ready batch",
        allocations: [{ orderItemId: item.id, quantity: "30" }],
      };
      const first = await production.create(admin, plan);
      expect((await production.planning(admin, orderId)).items[0].allocatedQuantity).toBe("30.000");
      await production.change(admin, first.id, {
        action: "allocate",
        version: 1,
        plan: { ...plan, allocations: [{ orderItemId: item.id, quantity: "40" }] },
      });
      expect((await production.planning(admin, orderId)).items[0].allocatedQuantity).toBe("40.000");
      expect((await production.list(admin, { orderId })).total).toBe(1);
      await production.change(admin, first.id, { action: "allocate", version: 2, plan });
      await expect(
        production.change(admin, first.id, {
          action: "readiness",
          version: 1,
          siteReady: false,
          notes: "Stale edit",
        }),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        production.create(admin, {
          ...plan,
          allocations: [{ orderItemId: item.id, quantity: "11" }],
        }),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        production.create(admin, {
          ...plan,
          allocations: [
            { orderItemId: item.id, quantity: "1" },
            { orderItemId: item.id, quantity: "1" },
          ],
        }),
      ).rejects.toThrow();
      const remaining = {
        ...plan,
        siteReady: false,
        notes: "Pending site batch",
        allocations: [{ orderItemId: item.id, quantity: "10" }],
      };
      const race = await Promise.allSettled([
        production.create(admin, remaining),
        production.create(admin, remaining),
      ]);
      expect(race.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(race.filter((r) => r.status === "rejected")).toHaveLength(1);
      const detail = await production.detail(admin, first.id);
      expect(detail.items[0].allocatedQuantity).toBe("40.000");
      expect(detail.loads).toHaveLength(2);
      expect(detail.loads.find((l) => l.loadNumber === 2)?.siteReady).toBe(false);
      const allocation = detail.allocations[0];
      const otherItem = (await production.planning(admin, orderIds[(company + 1) % 3])).items[0];
      await expect(
        production.create(admin, {
          ...plan,
          allocations: [{ orderItemId: otherItem.id, quantity: "1" }],
        }),
      ).rejects.toMatchObject({ status: 400 });
      expect((await production.list(admin, { orderId })).total).toBe(2);
      await expect(
        db.insert(schema.productionLoadItems).values({
          organizationId: detail.order.organizationId,
          loadId: first.id,
          orderItemId: otherItem.id,
          quantity: "1",
        }),
      ).rejects.toThrow();
      await expect(
        db
          .update(schema.orderItems)
          .set({ allocatedQuantity: "0" })
          .where(eq(schema.orderItems.id, item.id)),
      ).rejects.toThrow();
      await expect(
        db
          .update(schema.productionLoadItems)
          .set({ quantity: "31" })
          .where(eq(schema.productionLoadItems.id, allocation.id)),
      ).rejects.toThrow();
      await expect(
        db.insert(schema.productionLoadItems).values({
          organizationId: detail.order.organizationId,
          loadId: first.id,
          orderItemId: item.id,
          quantity: "1",
        }),
      ).rejects.toThrow();
      await expect(
        db
          .update(schema.orderItems)
          .set({ quantity: "39" })
          .where(eq(schema.orderItems.id, item.id)),
      ).rejects.toThrow();
      await expect(
        production.change(sales, first.id, {
          action: "readiness",
          version: detail.load.version,
          siteReady: true,
          notes: "Forbidden",
        }),
      ).rejects.toMatchObject({ status: company === 0 ? 403 : 404 });
      expect(
        (await production.list(admin, { orderId, status: "planned", readiness: "pending" })).total,
      ).toBe(1);
      await expect(
        production.change(admin, first.id, {
          action: "advance",
          version: detail.load.version,
          target: "released",
          occurredAt: "2020-01-01T10:00:00+05:30",
          reference: "Unauthorized release",
          notes: "Missing survey approvals",
        }),
      ).rejects.toMatchObject({ status: 409 });
    });
  it("checks Accounts assignment and current grants before financial access", async () => {
    await command(orderIds[0], 9, "plan", {
      assignedTo: accountsId,
      plannedAt: "2020-01-01T10:00:00Z",
    });
    const finance = commerceService(db, settings);
    expect((await finance.detail(accounts, orderIds[0])).permissions.payments).toBe(true);
    await expect(
      finance.command(coordinator, orderIds[0], {
        action: "milestone.save",
        version: 0,
        loadId: (await finance.detail(admin, orderIds[0])).loads[0].id,
        name: "Unauthorized terms",
        amount: "0",
        beforeDispatch: true,
        contractReference: "Unapproved",
        notes: "No Admin authority",
      }),
    ).rejects.toMatchObject({ status: 403 });
    await db
      .delete(schema.rolePermissions)
      .where(
        and(
          eq(schema.rolePermissions.organizationId, orgs[0].id),
          eq(schema.rolePermissions.role, "Accounts"),
          eq(schema.rolePermissions.permission, "payments.manage"),
        ),
      );
    await expect(finance.detail(accounts, orderIds[0])).rejects.toMatchObject({ status: 403 });
    await db
      .insert(schema.rolePermissions)
      .values({ organizationId: orgs[0].id, role: "Accounts", permission: "payments.manage" });
    expect((await finance.detail(accounts, orderIds[0])).permissions.payments).toBe(true);
  });
  it("scopes installation teams and audit engineers and rechecks revoked module grants", async () => {
    const api = aftercareService(db, settings),
      id = orderIds[0],
      load = (await service.detail(admin, id)).loads[0];
    await api.change(coordinator, id, {
      action: "installation.plan",
      loadId: load.id,
      version: 0,
      assignedTo: installerId,
      teamName: "Assigned installation crew",
      teamMembers: [installerId],
      plannedAt: "2020-01-01T10:00:00+05:30",
      remarks: "Scoped crew assignment",
    });
    const d = await api.detail(installer, id),
      i = d.installations[0];
    await expect(
      api.change(installer, id, {
        action: "installation.start",
        id: i.id,
        version: i.version,
        occurredAt: "2020-01-01T10:00:00+05:30",
        notes: "No confirmed delivery",
      }),
    ).rejects.toMatchObject({ status: 400 });
    await api.change(coordinator, id, {
      action: "audit.plan",
      installationId: i.id,
      version: 0,
      engineerId,
      plannedAt: "2020-01-01T10:00:00+05:30",
      notes: "Assigned quality engineer",
    });
    expect((await api.detail(engineer, id)).audits[0].engineerId).toBe(engineerId);
    await expect(
      api.change(engineer, id, {
        action: "installation.start",
        id: i.id,
        version: i.version,
        occurredAt: "2020-01-01T10:00:00+05:30",
        notes: "Wrong role",
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(api.detail(outsider, id)).rejects.toMatchObject({ status: 404 });
    await db
      .delete(schema.rolePermissions)
      .where(
        and(
          eq(schema.rolePermissions.organizationId, orgs[0].id),
          eq(schema.rolePermissions.role, "Installation Team"),
          eq(schema.rolePermissions.permission, "installations.manage"),
        ),
      );
    await expect(api.detail(installer, id)).rejects.toMatchObject({ status: 403 });
    await db.insert(schema.rolePermissions).values({
      organizationId: orgs[0].id,
      role: "Installation Team",
      permission: "installations.manage",
    });
  });
  for (let company = 0; company < 3; company++)
    it(`completes all sixteen stages for company ${company + 1} with approval and contractual gates`, async () => {
      const id = orderIds[company],
        glass = orgs[company].slug === "s-grip";
      for (let number = 1; number <= 16; number++) {
        if (number === 9)
          await exerciseCommerce(
            db,
            settings,
            admin,
            id,
            store,
            company === 0,
            company === 0 ? sales : undefined,
            company === 0 ? accounts : undefined,
          );
        if (number === 12)
          await exerciseInstallation(
            db,
            settings,
            admin,
            id,
            store,
            company === 0 ? sales : undefined,
          );
        if (number === 15) await exerciseHandover(db, settings, admin, id);
        let current = await stage(id, number);
        await command(id, number, "plan", {
          assignedTo: adminId,
          plannedAt: "2020-01-01T10:00:00Z",
        });
        current = await stage(id, number);
        if (current.status === "pending") await command(id, number, "start");
        const data = stageData(number, glass);
        if (number === 9 && company === 0) data.verifiedReceipts = "100.00";
        if (number === 6)
          await expect(
            command(id, number, "submit", {
              data: { ...data, loadCount: 3 },
              notes: "Mismatch with actual allocated loads",
            }),
          ).rejects.toMatchObject({ status: 400 });
        if (number === 1)
          await expect(
            command(id, number, "submit", { data, notes: "Missing required document" }),
          ).rejects.toMatchObject({ status: 400 });
        await service.upload(
          admin,
          id,
          number,
          { name: `stage-${number}.png`, contentType: "image/png", bytes: png },
          store,
        );
        if (number === 4)
          await expect(command(id, 7, "start")).rejects.toMatchObject({ status: 409 });
        if (number === 9) {
          await expect(
            command(id, number, "submit", {
              data: { ...data, verifiedReceipts: "39.99" },
              notes: "Insufficient contractual receipts",
            }),
          ).rejects.toMatchObject({ status: 400 });
          await expect(command(id, 10, "start")).rejects.toMatchObject({ status: 409 });
        }
        if (number === 13 && glass)
          await expect(
            command(id, number, "submit", {
              data: { ...data, glassTemplateApproved: false },
              notes: "Template approval missing",
            }),
          ).rejects.toMatchObject({ status: 400 });
        if (number === 14)
          await expect(
            command(id, number, "submit", {
              data: { ...data, auditPassed: false },
              notes: "Outstanding audit issues",
            }),
          ).rejects.toMatchObject({ status: 400 });
        if (number === 16)
          await expect(
            command(id, number, "submit", {
              data: { ...data, reviewRequestedAt: "2019-01-01T00:00:00Z" },
              notes: "A request before handover is invalid",
            }),
          ).rejects.toMatchObject({ status: 400 });
        await command(id, number, "submit", {
          data,
          notes: `Evidence verified for ${stageDefinition(number).name}`,
        });
        await expect(
          command(id, number, "save", { data, notes: "Cannot overwrite submitted evidence" }),
        ).rejects.toMatchObject({ status: 409 });
        if (number === 1 && company === 0) {
          await expect(command(id, number, "approve", {}, coordinator)).rejects.toMatchObject({
            status: 403,
          });
          await command(id, number, "reject", { reason: "Confirm group evidence before approval" });
          expect((await stage(id, number)).status).toBe("changes_requested");
          await command(id, number, "submit", {
            data,
            notes: "Group evidence confirmed after review",
          });
        }
        if (number === 6 && company === 0) {
          const submitted = await stage(id, number),
            results = await Promise.allSettled([
              service.transition(admin, id, number, {
                action: "approve",
                version: submitted.version,
              }),
              service.transition(admin, id, number, {
                action: "approve",
                version: submitted.version,
              }),
            ]);
          expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
          expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
        } else await command(id, number, "approve", { reason: "Evidence and documents reviewed" });
        current = await stage(id, number);
        expect(current.status).toBe("completed");
        expect(current.approvedBy).toBe(adminId);
        expect(current.startedAt).toBeInstanceOf(Date);
        expect(current.completedAt).toBeInstanceOf(Date);
        await expect(command(id, number, "start")).rejects.toMatchObject({ status: 409 });
        if (number === 6) {
          const planned = (await service.detail(admin, id)).loads;
          expect(planned).toHaveLength(2);
          for (const target of ["released", "in_production"] as const) {
            const load = await production.detail(admin, planned[0].id);
            await production.change(admin, load.load.id, {
              action: "advance",
              version: load.load.version,
              target,
              occurredAt: "2020-01-01T10:00:00+05:30",
              reference: `Early independent ${target}`,
              notes: "First load proceeds while remaining site is pending",
              estimatedAt: "2020-01-02T10:00:00Z",
            });
          }
          expect((await production.detail(admin, planned[1].id)).load.status).toBe("planned");
          expect((await service.detail(admin, id)).order.stage).toBe(7);
        }
      }
      const detail = await service.detail(admin, id);
      expect(detail.order.completedAt).toBeInstanceOf(Date);
      expect(detail.stages.every((s) => s.status === "completed")).toBe(true);
      expect(detail.stages[15].data.reviewOutcome).toBe("declined");
      expect(detail.stages[8].data.verifiedReceipts).toBe(company === 0 ? "100.00" : "40.00");
      expect(detail.order.finalValue).toBe("100.00");
      expect(detail.historyTotal).toBeGreaterThan(16);
      expect(detail.events).toHaveLength(25);
    });
  it("retains aftercare evidence and service assignments after the order closes", async () => {
    const api = aftercareService(db, settings),
      id = orderIds[0];
    let d = await api.detail(admin, id);
    const t = d.tickets[0];
    await api.change(coordinator, id, {
      action: "ticket.status",
      id: t.id,
      version: t.version,
      status: "open",
      notes: "Customer requested further follow-up",
    });
    d = await api.detail(admin, id);
    await api.change(coordinator, id, {
      action: "ticket.assign",
      id: t.id,
      version: d.tickets[0].version,
      assignedTo: engineerId,
      priority: "urgent",
      dueAt: "2020-01-01T10:00:00+05:30",
      notes: "Assigned service engineer",
    });
    d = await api.detail(engineer, id);
    await api.change(engineer, id, {
      action: "ticket.status",
      id: t.id,
      version: d.tickets[0].version,
      status: "in_progress",
      notes: "Engineer accepted complaint",
    });
    expect(
      (
        await api.list(
          coordinator,
          { status: "in_progress", priority: "urgent", overdue: "yes" },
          "service",
        )
      ).total,
    ).toBe(1);
    const photo = d.files.find((f) => f.kind === "installation_photo")!;
    const before = signCalls;
    await expect(api.download(outsider, id, photo.id, store)).rejects.toMatchObject({
      status: 404,
    });
    expect(signCalls).toBe(before);
    expect((await api.download(admin, id, photo.id, store)).expiresIn).toBe(60);
    await expect(
      api.change(admin, id, {
        action: "handover.prepare",
        notes: "Cannot rewrite confirmed handover",
      }),
    ).rejects.toMatchObject({ status: 409 });
    for (const table of [
      "aftercare_events",
      "aftercare_files",
      "installation_entries",
      "installations",
      "engineer_audits",
      "handovers",
    ])
      await expect(db.execute(sql.raw(`delete from ${table}`))).rejects.toThrow();
    await expect(
      db.execute(sql`update production_load_items set installed_quantity=0`),
    ).rejects.toThrow();
    expect((await api.detail(admin, id)).order.completedAt).toBeInstanceOf(Date);
  });
  it("serializes installment totals, rejects invalid allocations and preserves verified financial history", async () => {
    const finance = commerceService(db, settings),
      id = orderIds[1],
      date = "2020-01-01T10:00:00+05:30";
    const record = (reference: string) =>
      finance.command(admin, id, {
        action: "payment.record",
        amount: "40.00",
        mode: "upi",
        reference,
        receivedAt: date,
        notes: "Additional actual installment",
      });
    const results = await Promise.allSettled([
      record("Racing receipt A"),
      record("Racing receipt B"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    const winner = results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<{
      id: string;
    }>;
    await finance.upload(
      admin,
      id,
      "payment",
      winner.value.id,
      { name: "receipt.png", contentType: "image/png", bytes: png },
      store,
    );
    await finance.command(admin, id, {
      action: "payment.verify",
      id: winner.value.id,
      version: 1,
      notes: "Accounts verified actual additional funds",
    });
    await expect(
      finance.command(admin, id, {
        action: "payment.reject",
        id: winner.value.id,
        version: 2,
        notes: "Cannot erase verified money",
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await finance.detail(admin, id)).totals.verified).toBe("80.00");
    expect((await finance.detail(admin, id)).totals.outstanding).toBe("20.00");
    const correction = await finance.command(admin, id, {
      action: "payment.record",
      amount: "10",
      mode: "cash",
      reference: "Correction receipt reference",
      receivedAt: date,
      notes: "Incorrect pending entry",
    });
    await finance.command(admin, id, {
      action: "payment.reject",
      id: correction.id,
      version: 1,
      notes: "Reject incorrect pending record with original history intact",
    });
    await finance.command(admin, id, {
      action: "payment.record",
      amount: "10",
      mode: "cash",
      reference: "Correction receipt reference",
      receivedAt: date,
      notes: "Corrected pending entry under the same receipt reference",
    });
    await expect(
      db
        .update(schema.payments)
        .set({ amount: "1" })
        .where(eq(schema.payments.id, winner.value.id)),
    ).rejects.toThrow();
    await expect(
      db.insert(schema.payments).values({
        organizationId: orgs[1].id,
        orderId: id,
        amount: "30",
        reference: "SQL overpayment attempt",
        receivedAt: new Date(date),
        recordedBy: adminId,
      }),
    ).rejects.toThrow();
    await expect(
      db.update(schema.orders).set({ recordedPaymentAmount: "0" }).where(eq(schema.orders.id, id)),
    ).rejects.toThrow();
    const financial = await finance.detail(admin, id),
      allocation = financial.allocations[0];
    await expect(
      db
        .update(schema.paymentAllocations)
        .set({ amount: "0.01" })
        .where(eq(schema.paymentAllocations.id, allocation.id)),
    ).rejects.toThrow();
    await expect(
      db.insert(schema.paymentAllocations).values({
        organizationId: orgs[1].id,
        orderId: id,
        paymentId: winner.value.id,
        milestoneId: allocation.milestoneId,
        amount: "1",
        allocatedBy: adminId,
      }),
    ).rejects.toThrow();
    expect(
      (await finance.detail(admin, id)).payments.find((p) => p.id === winner.value.id)
        ?.allocatedAmount,
    ).toBe("0.00");
    const file = financial.files.find((f) => f.paymentId === winner.value.id)!;
    expect((await finance.download(admin, id, file.id, store)).expiresIn).toBe(60);
    await expect(finance.download(outsider, orderIds[0], file.id, store)).rejects.toMatchObject({
      status: 404,
    });
    await expect(db.execute(sql`update commerce_events set notes='tampered'`)).rejects.toThrow();
    const managed = await finance.detail(coordinator, orderIds[0]);
    expect(managed.payments).toHaveLength(0);
    expect(managed.files.every((f) => !f.paymentId)).toBe(true);
    expect(
      managed.events.every(
        (e) => !e.action.startsWith("payment.") && !e.action.startsWith("milestone."),
      ),
    ).toBe(true);
    const privateReceipt = (await finance.detail(admin, orderIds[0])).files.find(
      (f) => f.paymentId,
    )!;
    await expect(
      finance.download(coordinator, orderIds[0], privateReceipt.id, store),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("aggregates real cohorts without multiplying order values by items, loads or installments", async () => {
    const analytics = managementService(db, settings),
      all = await analytics.dashboard(admin, {}),
      one = await analytics.dashboard(admin, { organizationId: orgs[0].id });
    expect(all.kpis.won_orders).toBe("3");
    expect(new Decimal(String(all.kpis.confirmed_order_value)).toFixed(2)).toBe("300.00");
    expect(new Decimal(String(all.kpis.payments_received)).toFixed(2)).toBe("220.00");
    expect(new Decimal(String(all.kpis.outstanding_payments)).toFixed(2)).toBe("80.00");
    expect(one.kpis.won_orders).toBe("1");
    expect(new Decimal(String(one.kpis.payments_received)).toFixed(2)).toBe("100.00");
    expect((await analytics.dashboard(admin, { executiveId: salesId })).kpis.won_orders).toBe("1");
    const managerView = await analytics.dashboard(manager, {});
    expect(managerView.kpis.won_orders).toBe("1");
    expect(managerView.kpis.payments_received).toBeNull();
    expect(managerView.kpis.outstanding_payments).toBeNull();
    expect((await analytics.report(manager, "production", {})).total).toBe(2);
    await expect(analytics.report(manager, "payments", {})).rejects.toMatchObject({ status: 403 });
    await expect(analytics.export(manager, "payments", {}, "csv")).rejects.toMatchObject({
      status: 403,
    });
    await expect(analytics.dashboard(sales, {})).rejects.toMatchObject({ status: 403 });
    await expect(analytics.report(outsider, "sales", {})).rejects.toMatchObject({ status: 403 });
    expect(
      (await analytics.dashboard(admin, { from: "2019-01-01", to: "2020-12-31" })).kpis.won_orders,
    ).toBe("0");
    const collected = await analytics.report(admin, "payments", {
      status: "verified",
      from: "2020-01-01",
      to: "2020-12-31",
    });
    expect(
      collected.rows.reduce((total, r) => total.plus(String(r.amount)), new Decimal(0)).toFixed(2),
    ).toBe("220.00");
    for (const type of Object.keys(reports))
      expect((await analytics.report(admin, type, {})).columns).toBeDefined();
    await db
      .delete(schema.rolePermissions)
      .where(
        and(
          eq(schema.rolePermissions.organizationId, orgs[0].id),
          eq(schema.rolePermissions.role, "Sales Manager"),
          eq(schema.rolePermissions.permission, "reports.read"),
        ),
      );
    await expect(analytics.export(manager, "sales", {}, "xlsx")).rejects.toMatchObject({
      status: 403,
    });
    await db
      .insert(schema.rolePermissions)
      .values({ organizationId: orgs[0].id, role: "Sales Manager", permission: "reports.read" });
  });
  it("exports the full filtered payment result beyond the first page as safe CSV and Excel", async () => {
    const analytics = managementService(db, settings),
      finance = commerceService(db, settings);
    for (let n = 0; n < 26; n++)
      await finance.command(admin, orderIds[1], {
        action: "payment.record",
        amount: "0.01",
        mode: "upi",
        reference: `Export pagination ${n}`,
        receivedAt: "2019-04-01T10:00:00+05:30",
        notes: "Isolated pagination fixture",
      });
    const f = { organizationId: orgs[1].id, from: "2019-04-01", to: "2019-04-01" },
      first = await analytics.report(admin, "payments", f),
      second = await analytics.report(admin, "payments", { ...f, page: 2 });
    expect(first.total).toBe(26);
    expect(first.rows).toHaveLength(25);
    expect(second.rows).toHaveLength(1);
    const csv = await analytics.export(admin, "payments", { ...f, page: 2 }, "csv");
    expect(new TextDecoder().decode(csv.bytes).trim().split("\r\n")).toHaveLength(27);
    const excel = await analytics.export(admin, "payments", f, "xlsx"),
      book = new ExcelJS.Workbook();
    await book.xlsx.load(new Uint8Array(excel.bytes).buffer);
    expect(book.getWorksheet("Report")!.rowCount).toBe(27);
    expect(book.getWorksheet("Report")!.getCell("C2").value).toBe("0.01");
    expect(
      (await analytics.dashboard(admin, { organizationId: orgs[1].id })).kpis.payments_received,
    ).toBe("80.00");
  });
  it("persists scoped Admin catalogs, exact pipeline filters, active territories and version checks", async () => {
    const config = settingsService(db, settings),
      analytics = managementService(db, settings);
    await expect(config.list(manager, {})).rejects.toMatchObject({ status: 403 });
    const territory = {
      organizationId: orgs[0].id,
      kind: "territory",
      code: "north",
      name: "North",
      active: true,
      version: 0,
      config: { description: "Sales territory" },
      notes: "Configure company territory",
    };
    const saved = await config.save(admin, territory);
    await expect(config.save(manager, territory)).rejects.toMatchObject({ status: 403 });
    await expect(
      config.save(admin, { ...territory, id: saved.id, version: 0 }),
    ).rejects.toMatchObject({ status: 409 });
    const base = leadFormSchema.parse({
      organizationId: orgs[0].id,
      centreId: centres.find((c) => c.organizationId === orgs[0].id)!.id,
      assignedTo: salesId,
      clientName: "Management filter 1",
      mobile: "9876790001",
      projectName: "North site",
      siteAddress: "Isolated North site",
      financialYear: "2026-27",
      territory: "North",
      expectedValue: "0.10",
      nextFollowUp: new Date(Date.now() - 3600000).toISOString(),
      nextAction: "Call customer",
    });
    await leads.create(admin, base);
    await leads.create(admin, {
      ...base,
      clientName: "Management filter 2",
      mobile: "9876790002",
      projectName: "North second site",
      siteAddress: "Isolated second North site",
      expectedValue: "0.20",
      nextFollowUp: "",
      nextAction: "",
    });
    await expect(
      leads.create(admin, {
        ...base,
        clientName: "Invalid territory",
        mobile: "9876790003",
        territory: "South",
      }),
    ).rejects.toMatchObject({ status: 400 });
    const d = await analytics.dashboard(manager, {
      financialYear: "2026-27",
      territory: "North",
      executiveId: salesId,
    });
    expect(d.kpis.active_leads).toBe("2");
    expect(d.kpis.expected_pipeline_value).toBe("0.30");
    expect(d.kpis.pending_follow_ups).toBe("1");
    for (const [kind, code, name, body] of [
      ["product_category", "windows", "Window category", { description: "Windows", unit: "items" }],
      [
        "payment_template",
        "advance",
        "Contract advance",
        {
          percentage: "40.00",
          beforeDispatch: true,
          offsetDays: 7,
          description: "Approved terms template",
        },
      ],
      [
        "document_requirement",
        "completion-pack",
        "Completion pack",
        { stageNumber: 15, description: "Customer evidence" },
      ],
    ] as const)
      await config.save(admin, {
        organizationId: orgs[0].id,
        kind,
        code,
        name,
        config: body,
        active: true,
        version: 0,
        notes: "Company operational configuration",
      });
    expect((await commerceService(db, settings).detail(admin, orderIds[0])).templates[0].name).toBe(
      "Contract advance",
    );
    await expect(
      db.delete(schema.adminCatalog).where(eq(schema.adminCatalog.id, saved.id)),
    ).rejects.toThrow();
  });
  it("shows real overdue work, respects SLA changes and persists per-user notification decisions", async () => {
    const notifications = notificationService(db, settings),
      config = settingsService(db, settings);
    let result = await notifications.list(sales, {});
    const alert = result.rows.find(
      (r) => r.kind === "follow_up" && r.client === "Management filter 1",
    )!;
    expect(alert).toBeDefined();
    await expect(
      notifications.change(outsider, {
        kind: alert.kind,
        entityId: alert.entity_id,
        dueAt: alert.due_at,
        state: "read",
      }),
    ).rejects.toMatchObject({ status: 404 });
    await notifications.change(sales, {
      kind: alert.kind,
      entityId: alert.entity_id,
      dueAt: alert.due_at,
      state: "read",
    });
    expect(
      (await notifications.list(sales, {})).rows.find((r) => r.entity_id === alert.entity_id)
        ?.state,
    ).toBe("read");
    expect(
      (await notifications.list(admin, {})).rows.find((r) => r.entity_id === alert.entity_id)
        ?.state,
    ).toBe("unread");
    const sla = {
      organizationId: orgs[0].id,
      kind: "sla",
      code: "follow_up",
      name: "Follow-up grace",
      active: true,
      version: 0,
      config: { target: "follow_up", graceHours: 2, description: "Company allowance" },
      notes: "Configure operational grace",
    };
    const { id } = await config.save(admin, sla);
    expect(
      (await notifications.list(sales, {})).rows.some((r) => r.entity_id === alert.entity_id),
    ).toBe(false);
    await config.save(admin, { ...sla, id, version: 1, config: { ...sla.config, graceHours: 0 } });
    result = await notifications.list(sales, {});
    expect(result.rows.find((r) => r.entity_id === alert.entity_id)?.state).toBe("read");
    await notifications.change(sales, {
      kind: alert.kind,
      entityId: alert.entity_id,
      dueAt: alert.due_at,
      state: "dismissed",
    });
    expect(
      (await notifications.list(sales, {})).rows.some((r) => r.entity_id === alert.entity_id),
    ).toBe(false);
  });
  it("preserves company boundaries and snapshots custom document rules on new orders", async () => {
    const config = settingsService(db, settings);
    await expect(config.list(localAdmin, { organizationId: orgs[1].id })).rejects.toMatchObject({
      status: 403,
    });
    expect((await config.list(localAdmin, {})).companies.map((c) => c.id)).toEqual([orgs[0].id]);
    const company = orgs[2],
      profile = {
        organizationId: company.id,
        kind: "company_profile",
        code: company.slug,
        name: company.name,
        active: false,
        version: 0,
        config: {
          legalName: company.name,
          address: "Registered office",
          email: "office@example.test",
          phone: "9000000099",
          gstin: "",
        },
        notes: "Set company intake availability",
      };
    const saved = await config.save(admin, profile);
    await expect(
      config.save(admin, { ...profile, name: "Changed canonical company" }),
    ).rejects.toMatchObject({ status: 400 });
    const input = leadFormSchema.parse({
      organizationId: company.id,
      centreId: centres.find((c) => c.organizationId === company.id)!.id,
      assignedTo: adminId,
      clientName: "Document snapshot customer",
      mobile: "9876790099",
      projectName: "Document policy site",
      siteAddress: "Isolated document policy address",
    });
    await expect(leads.create(admin, input)).rejects.toMatchObject({ status: 409 });
    await config.save(admin, { ...profile, id: saved.id, version: 1, active: true });
    const requirement = {
      organizationId: company.id,
      kind: "document_requirement",
      code: "group-evidence",
      name: "Group consent document",
      active: true,
      version: 0,
      config: { stageNumber: 1, description: "Company requirement" },
      notes: "Require customer evidence",
    };
    const fileRule = await config.save(admin, requirement),
      lead = await leads.create(admin, input);
    for (let number = 2; number <= 6; number++) {
      const d = await leads.detail(admin, lead.id);
      await leads.update(admin, lead.id, {
        version: d.lead.version,
        data: {
          ...input,
          customerId: d.lead.customerId,
          projectId: d.lead.projectId,
          stage: number,
        },
      });
    }
    const quote = await presales.quotation(admin, lead.id, {
      expectedRevision: 0,
      items: [
        {
          name: "Policy product",
          description: "Isolated",
          productCompanyId: company.id,
          quantity: "1",
          unitPrice: "10",
          discount: "0",
        },
      ],
    });
    await presales.decide(admin, lead.id, {
      quotationId: quote.id,
      decision: "accepted",
      evidence: "Customer accepted",
    });
    const d = await leads.detail(admin, lead.id),
      order = await presales.convert(admin, lead.id, {
        version: d.lead.version,
        organizationId: company.id,
        quotationId: quote.id,
        finalValue: "10",
        quantitiesConfirmed: true,
      });
    expect((await stage(order.id, 1)).documentRequirements).toEqual([
      { id: fileRule.id, name: requirement.name },
    ]);
    await command(order.id, 1, "plan", { assignedTo: adminId, plannedAt: "2020-01-01T10:00:00Z" });
    await command(order.id, 1, "start");
    await service.upload(
      admin,
      order.id,
      1,
      { name: "general.png", contentType: "image/png", bytes: png },
      store,
    );
    await expect(
      command(order.id, 1, "submit", {
        data: stageData(1),
        notes: "General evidence is insufficient",
      }),
    ).rejects.toMatchObject({ status: 400 });
    await config.save(admin, {
      ...requirement,
      id: fileRule.id,
      version: 1,
      active: false,
      name: "New document label",
    });
    expect((await service.detail(admin, order.id)).requirements[0].name).toBe(
      "Group consent document",
    );
    await service.upload(
      admin,
      order.id,
      1,
      { name: "consent.png", contentType: "image/png", bytes: png, requirementId: fileRule.id },
      store,
    );
    await command(order.id, 1, "submit", {
      data: stageData(1),
      notes: "Required company document uploaded",
    });
    expect((await stage(order.id, 1)).status).toBe("awaiting_approval");
  });
  it("preserves approved history and private documents while denying public access", async () => {
    const id = orderIds[0],
      detail = await service.detail(admin, id, { fileStage: 1 }),
      file = detail.files[0],
      before = signCalls;
    await expect(service.download(outsider, id, file.id, store)).rejects.toMatchObject({
      status: 404,
    });
    expect(signCalls).toBe(before);
    expect((await service.download(admin, id, file.id, store)).expiresIn).toBe(60);
    await expect(
      db
        .update(schema.orderStages)
        .set({ notes: "tampered" })
        .where(eq(schema.orderStages.id, detail.stages[0].id)),
    ).rejects.toThrow();
    await expect(db.execute(sql`update order_stage_events set notes='tampered'`)).rejects.toThrow();
    await expect(
      db.execute(sql`update production_load_events set notes='tampered'`),
    ).rejects.toThrow();
    const allocatedLoad = detail.loads[0];
    await expect(
      production.change(admin, allocatedLoad.id, {
        action: "readiness",
        version: allocatedLoad.version,
        siteReady: false,
        notes: "Cannot rewrite completed load",
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      db
        .delete(schema.productionLoadItems)
        .where(eq(schema.productionLoadItems.loadId, allocatedLoad.id)),
    ).rejects.toThrow();
    await expect(
      db.update(schema.documents).set({ name: "tampered" }).where(eq(schema.documents.id, file.id)),
    ).rejects.toThrow();
    await service.configure(admin, {
      organizationId: orgs[0].id,
      number: 3,
      version: 1,
      ownerRole: "Admin",
      approverRole: "Admin",
      requiredFields: stageDefinition(3).requiredFields,
      applyToPending: true,
    });
    expect((await stage(id, 3)).ownerRole).toBe("Survey Engineer");
    expect((await stage(id, 3)).requiredFields).toContain("attachments");
    await pg.exec("SET ROLE anon");
    try {
      for (const table of [
        "order_stages",
        "order_stage_events",
        "order_stage_policies",
        "production_load_events",
        "payments",
        "payment_milestones",
        "payment_allocations",
        "dispatches",
        "dispatch_items",
        "deliveries",
        "delivery_items",
        "commerce_files",
        "commerce_events",
        "admin_catalog",
        "notification_receipts",
        "aftercare_events",
        "aftercare_files",
        "installation_entries",
        "audit_punch_items",
        "customer_feedback",
        "sgrip_glass_checklists",
        "installations",
        "engineer_audits",
        "handovers",
        "service_tickets",
      ])
        await expect(pg.query(`select * from ${table}`)).rejects.toThrow();
    } finally {
      await pg.exec("RESET ROLE");
    }
  });
});
