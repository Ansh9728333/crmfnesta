import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Database } from "../../src/lib/db";
import * as schema from "../../src/lib/db/schema";
import { buildAuth } from "../../src/lib/auth/config";
import { bootstrapAdmin } from "../../src/lib/auth/bootstrap";
import { employeeService } from "../../src/lib/employees/service";
import { hasPermission, orderPredicate, resolveAccess } from "../../src/lib/auth/access";
import { changeEmployeePassword } from "../../src/lib/auth/password";
import { handleAuth } from "../../src/lib/auth/handler";
import { authorizedDocument } from "../../src/lib/documents/service";

const pg = new PGlite();
const db = drizzle(pg, { schema }) as unknown as Database;
const settings = {
  secret: randomUUID() + randomUUID(),
  url: "http://localhost:3000",
  rateLimit: false,
};
const auth = buildAuth(db, settings);
const service = employeeService(db, settings);
const initialPassword = `Initial-${randomUUID()}`;
const password = `Changed-${randomUUID()}`;
let adminHeaders: Headers;
let employeeHeaders: Headers;
let employeeId: string;
let orgs: (typeof schema.organizations.$inferSelect)[];
let branches: (typeof schema.centres.$inferSelect)[];
let input: Parameters<typeof service.create>[1];

function headersFrom(response: Response) {
  return new Headers({
    cookie: response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; "),
    origin: settings.url,
  });
}
function request(path: string, body?: unknown, headers?: Headers) {
  return new Request(`${settings.url}/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: settings.url,
      ...Object.fromEntries(headers ?? []),
    },
    body: JSON.stringify(body ?? {}),
  });
}
async function login(username: string, secret: string) {
  const response = await handleAuth(
    request("/sign-in/username", { username, password: secret }),
    auth,
    db,
  );
  return { response, headers: headersFrom(response) };
}

beforeAll(async () => {
  await pg.exec(
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA storage; CREATE TABLE storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text not null); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; GRANT USAGE ON SCHEMA storage TO anon, authenticated; GRANT SELECT, INSERT ON storage.objects TO anon, authenticated; CREATE POLICY existing_permissive_policy ON storage.objects FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);",
  );
  for (const migration of readMigrationFiles({ migrationsFolder: "./drizzle" }))
    for (const statement of migration.sql) await pg.exec(statement);
  await bootstrapAdmin(db, settings, {
    name: "Integration Administrator",
    email: "admin@example.test",
    username: "admin",
    password: initialPassword,
    mobile: "+919000000001",
    centre: "Integration branch",
  });
  const loginResult = await login("admin", initialPassword);
  expect(loginResult.response.status).toBe(200);
  expect((await resolveAccess(db, auth, loginResult.headers)).profile.mustChangePassword).toBe(
    false,
  );
  const changed = await changeEmployeePassword(db, settings, loginResult.headers, {
    currentPassword: initialPassword,
    newPassword: password,
  });
  adminHeaders = headersFrom(changed);
  orgs = await db.select().from(schema.organizations).orderBy(schema.organizations.slug);
  branches = await db.select().from(schema.centres);
  input = {
    name: "Integration Employee",
    username: "employee.one",
    email: "employee@example.test",
    mobile: "+919000000002",
    department: "Sales",
    active: true,
    password: initialPassword,
    assignments: [
      {
        organizationId: orgs[0].id,
        centreId: branches.find((c) => c.organizationId === orgs[0].id)!.id,
        role: "Sales Executive",
      },
    ],
  };
});
afterAll(async () => {
  await pg.close();
});

describe("real PostgreSQL authentication and authorization", () => {
  it("retires legacy first-login flags with audit history without changing credentials", async () => {
    const administrator = await resolveAccess(db, auth, adminHeaders);
    const [before] = await db
      .select()
      .from(schema.account)
      .where(eq(schema.account.userId, administrator.user.id));
    await db
      .update(schema.employeeProfiles)
      .set({ mustChangePassword: true })
      .where(eq(schema.employeeProfiles.userId, administrator.user.id));
    const migration = readMigrationFiles({ migrationsFolder: "./drizzle" }).at(-1)!;
    await db.transaction(async (transaction) => {
      for (const statement of migration.sql) await transaction.execute(sql.raw(statement));
    });
    const [after] = await db
      .select()
      .from(schema.account)
      .where(eq(schema.account.userId, administrator.user.id));
    expect(after.password).toBe(before.password);
    expect((await resolveAccess(db, auth, adminHeaders)).profile.mustChangePassword).toBe(false);
    const policyAudits = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.action, "employee.password-policy-updated"));
    expect(policyAudits).toHaveLength(3);
  });
  it("rejects oversized and non-JSON login requests before credential handling", async () => {
    const oversized = await handleAuth(
      request("/sign-in/username", { username: "body-limit-test", password: "x".repeat(4096) }),
      auth,
      db,
    );
    expect(oversized.status).toBe(413);
    expect(oversized.headers.get("cache-control")).toContain("no-store");
    const wrongType = request("/sign-in/username", {});
    wrongType.headers.set("content-type", "text/plain");
    expect((await handleAuth(wrongType, auth, db)).status).toBe(415);
  });
  it("bootstraps once and creates an employee through authorized Admin APIs", async () => {
    await expect(
      bootstrapAdmin(db, settings, {
        name: "Second Admin",
        email: "second@example.test",
        username: "second",
        password,
        mobile: "+919000000003",
        centre: "Integration branch",
      }),
    ).rejects.toThrow("Bootstrap");
    employeeId = (await service.create(adminHeaders, input)).id;
    const [profile] = await db
      .select()
      .from(schema.employeeProfiles)
      .where(eq(schema.employeeProfiles.userId, employeeId));
    expect(profile.employeeCode).toMatch(/^SF-/);
    expect(profile.mustChangePassword).toBe(false);
    const [credential] = await db
      .select()
      .from(schema.account)
      .where(eq(schema.account.userId, employeeId));
    expect(credential.password).not.toBe(initialPassword);
    expect(credential.providerId).toBe("credential");
  });
  it("rejects public signup and direct Admin API access, even with admin cookies", async () => {
    for (const path of [
      "/sign-up/email",
      "/admin/create-user",
      "/admin/set-user-password",
      "/update-user",
      "/sign-in/email",
    ]) {
      expect((await handleAuth(request(path, input, adminHeaders), auth, db)).status).toBe(403);
    }
    await expect(
      auth.api.signUpEmail({ body: { email: "public@example.test", name: "Public", password } }),
    ).rejects.toBeDefined();
  });
  it("edits an existing employee and rejects duplicate normalized usernames", async () => {
    await service.update(adminHeaders, employeeId, {
      ...(input as object),
      department: "Customer Success",
    });
    const [updated] = await db
      .select()
      .from(schema.employeeProfiles)
      .where(eq(schema.employeeProfiles.userId, employeeId));
    expect(updated.department).toBe("Customer Success");
    await expect(
      service.create(adminHeaders, {
        ...(input as object),
        username: "EMPLOYEE.ONE",
        email: "duplicate@example.test",
      }),
    ).rejects.toBeDefined();
  });
  it("permits direct login with the Admin-selected password and optional own password changes", async () => {
    const result = await login("EMPLOYEE.ONE", initialPassword);
    expect(result.response.status).toBe(200);
    expect((await resolveAccess(db, auth, result.headers)).user.id).toBe(employeeId);
    const changed = await changeEmployeePassword(db, settings, result.headers, {
      currentPassword: initialPassword,
      newPassword: password,
    });
    employeeHeaders = headersFrom(changed);
    expect((await resolveAccess(db, auth, employeeHeaders)).user.id).toBe(employeeId);
    const [profile] = await db
      .select()
      .from(schema.employeeProfiles)
      .where(eq(schema.employeeProfiles.userId, employeeId));
    expect(profile.lastLoginAt).toBeInstanceOf(Date);
  });
  it("rejects invalid credentials generically without revealing the incorrect field", async () => {
    const wrong = await login("employee.one", "Incorrect-password-123");
    const absent = await login("nonexistent", "Incorrect-password-123");
    expect(wrong.response.status).toBe(401);
    expect(await wrong.response.json()).toEqual(await absent.response.json());
  });
  it("denies normal employees provisioning and restricted employee data", async () => {
    await expect(service.create(employeeHeaders, input)).rejects.toMatchObject({ status: 403 });
    await expect(service.list(employeeHeaders)).rejects.toMatchObject({ status: 403 });
    await expect(
      service.action(
        employeeHeaders,
        (await resolveAccess(db, auth, adminHeaders)).user.id,
        "reset-password",
        password,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("enforces permission changes for existing sessions and isolates organizations", async () => {
    let access = await resolveAccess(db, auth, employeeHeaders);
    expect(hasPermission(access, orgs[0].id, "leads.write")).toBe(true);
    expect(hasPermission(access, orgs[1].id, "leads.read")).toBe(false);
    await service.updatePermissions(adminHeaders, {
      organizationId: orgs[0].id,
      role: "Sales Executive",
      permissions: [],
    });
    access = await resolveAccess(db, auth, employeeHeaders);
    expect(hasPermission(access, orgs[0].id, "leads.write")).toBe(false);
    expect(() => orderPredicate(access, orgs[1].id, "orders.read")).toThrow("Access denied");
    await service.updatePermissions(adminHeaders, {
      organizationId: orgs[0].id,
      role: "Sales Executive",
      permissions: ["leads.read", "orders.read", "documents.read"],
    });
  });
  it("refuses cross-organization assignments and prevents self-deactivation", async () => {
    const badInput = {
      ...(input as object),
      username: "another.user",
      email: "another@example.test",
      assignments: [
        {
          organizationId: orgs[0].id,
          centreId: branches.find((c) => c.organizationId === orgs[1].id)!.id,
          role: "Sales Executive",
        },
      ],
    };
    await expect(service.create(adminHeaders, badInput)).rejects.toMatchObject({ status: 400 });
    await expect(
      service.action(
        adminHeaders,
        (await resolveAccess(db, auth, adminHeaders)).user.id,
        "deactivate",
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("deactivation revokes existing sessions and prevents login", async () => {
    await service.action(adminHeaders, employeeId, "deactivate");
    await expect(resolveAccess(db, auth, employeeHeaders)).rejects.toMatchObject({ status: 401 });
    expect((await login("employee.one", password)).response.ok).toBe(false);
    const sessions = await db
      .select()
      .from(schema.session)
      .where(eq(schema.session.userId, employeeId));
    expect(sessions).toHaveLength(0);
    await service.action(adminHeaders, employeeId, "activate");
    employeeHeaders = (await login("employee.one", password)).headers;
  });
  it("Admin password reset revokes sessions and permits direct login with the selected password", async () => {
    await service.action(adminHeaders, employeeId, "reset-password", initialPassword);
    await expect(resolveAccess(db, auth, employeeHeaders)).rejects.toMatchObject({ status: 401 });
    const resetLogin = await login("employee.one", initialPassword);
    expect(resetLogin.response.status).toBe(200);
    expect((await resolveAccess(db, auth, resetLogin.headers)).profile.mustChangePassword).toBe(
      false,
    );
    employeeHeaders = headersFrom(
      await changeEmployeePassword(db, settings, resetLogin.headers, {
        currentPassword: initialPassword,
        newPassword: password,
      }),
    );
  });
  it("isolates assigned records and never signs unauthorized private documents", async () => {
    const [customer] = await db
      .insert(schema.customers)
      .values({ organizationId: orgs[0].id, name: "Integration customer" })
      .returning();
    const [lead] = await db
      .insert(schema.leads)
      .values({
        organizationId: orgs[0].id,
        customerId: customer.id,
        centreId: branches.find((c) => c.organizationId === orgs[0].id)!.id,
      })
      .returning();
    const [order] = await db
      .insert(schema.orders)
      .values({
        organizationId: orgs[0].id,
        leadId: lead.id,
        customerId: customer.id,
        centreId: lead.centreId,
        assignedTo: (await resolveAccess(db, auth, adminHeaders)).user.id,
      })
      .returning();
    const [document] = await db
      .insert(schema.documents)
      .values({
        organizationId: orgs[0].id,
        orderId: order.id,
        uploadedBy: employeeId,
        name: "test.pdf",
        objectPath: `${orgs[0].id}/${order.id}/test.pdf`,
        contentType: "application/pdf",
        byteSize: 10,
      })
      .returning();
    const signer = vi.fn(async () => "https://storage.example.test/signed-test-only");
    await expect(
      authorizedDocument(db, auth, employeeHeaders, document.id, signer),
    ).rejects.toMatchObject({ status: 404 });
    expect(signer).not.toHaveBeenCalled();
    await expect(
      authorizedDocument(db, auth, new Headers(), document.id, signer),
    ).rejects.toMatchObject({ status: 401 });
    expect(signer).not.toHaveBeenCalled();
    expect((await authorizedDocument(db, auth, adminHeaders, document.id, signer)).expiresIn).toBe(
      60,
    );
    const access = await resolveAccess(db, auth, employeeHeaders);
    expect(
      await db
        .select()
        .from(schema.orders)
        .where(orderPredicate(access, orgs[0].id, "orders.read")),
    ).toHaveLength(0);
    await db
      .update(schema.orders)
      .set({ assignedTo: employeeId })
      .where(eq(schema.orders.id, order.id));
    expect(
      (await authorizedDocument(db, auth, employeeHeaders, document.id, signer)).expiresIn,
    ).toBe(60);
    const [otherBranch] = await db
      .insert(schema.centres)
      .values({ organizationId: orgs[0].id, name: "Restricted integration branch" })
      .returning();
    await db
      .update(schema.orders)
      .set({ centreId: otherBranch.id })
      .where(eq(schema.orders.id, order.id));
    signer.mockClear();
    await expect(
      authorizedDocument(db, auth, employeeHeaders, document.id, signer),
    ).rejects.toMatchObject({ status: 404 });
    expect(signer).not.toHaveBeenCalled();
    await expect(
      db.insert(schema.projects).values({
        organizationId: orgs[1].id,
        customerId: customer.id,
        name: "Invalid cross-tenant project",
      }),
    ).rejects.toThrow();
  });
  it("persists auth records in PostgreSQL and enforces default-deny public access", async () => {
    expect((await db.select().from(schema.user)).length).toBe(2);
    await pg.exec("SET ROLE anon");
    try {
      await expect(pg.query('SELECT * FROM public."user"')).rejects.toThrow();
      await expect(pg.query("SELECT * FROM public.customers")).rejects.toThrow();
    } finally {
      await pg.exec("RESET ROLE");
    }
    const auditRows = await db.select().from(schema.auditLogs);
    expect(auditRows.length).toBeGreaterThan(5);
    expect(JSON.stringify(auditRows)).not.toContain(initialPassword);
    expect(JSON.stringify(auditRows)).not.toContain(password);
    await expect(db.execute(sql`update audit_logs set action = 'tampered'`)).rejects.toThrow();
  });
  it("denies direct browser access to the private bucket even with an existing permissive policy", async () => {
    await pg.exec(
      "INSERT INTO storage.objects(bucket_id) VALUES ('siteflow-documents'), ('unrelated-test-bucket')",
    );
    await pg.exec("SET ROLE anon");
    try {
      expect(
        (await pg.query("SELECT * FROM storage.objects WHERE bucket_id = 'siteflow-documents'"))
          .rows,
      ).toHaveLength(0);
      expect(
        (await pg.query("SELECT * FROM storage.objects WHERE bucket_id = 'unrelated-test-bucket'"))
          .rows,
      ).toHaveLength(1);
      await expect(
        pg.exec("INSERT INTO storage.objects(bucket_id) VALUES ('siteflow-documents')"),
      ).rejects.toThrow();
    } finally {
      await pg.exec("RESET ROLE");
    }
  });
  it("scopes Admin authority to their organizations and prevents administrative escalation", async () => {
    const assignment = {
      organizationId: orgs[0].id,
      centreId: branches.find((c) => c.organizationId === orgs[0].id)!.id,
      role: "Admin",
    };
    const limitedAdmin = await service.create(adminHeaders, {
      ...(input as object),
      name: "Scoped Administrator",
      username: "scoped.admin",
      email: "scoped-admin@example.test",
      assignments: [assignment],
    });
    const signedIn = await login("scoped.admin", initialPassword);
    const limitedHeaders = headersFrom(
      await changeEmployeePassword(db, settings, signedIn.headers, {
        currentPassword: initialPassword,
        newPassword: password,
      }),
    );
    const scoped = await service.list(limitedHeaders);
    expect(scoped.organizations.map((o) => o.id)).toEqual([orgs[0].id]);
    expect(scoped.employees.some((e) => e.id === employeeId)).toBe(true);
    const outsiderAssignment = {
      organizationId: orgs[1].id,
      centreId: branches.find((c) => c.organizationId === orgs[1].id)!.id,
      role: "Sales Executive",
    };
    await expect(
      service.create(limitedHeaders, {
        ...(input as object),
        username: "outside.org",
        email: "outside@example.test",
        assignments: [outsiderAssignment],
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.update(limitedHeaders, employeeId, {
        ...(input as object),
        assignments: [assignment],
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.updatePermissions(limitedHeaders, {
        organizationId: orgs[1].id,
        role: "Sales Executive",
        permissions: ["leads.write"],
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.action(
        limitedHeaders,
        (await resolveAccess(db, auth, adminHeaders)).user.id,
        "deactivate",
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.createCentre(limitedHeaders, {
        organizationId: orgs[1].id,
        name: "Forbidden branch",
      }),
    ).rejects.toMatchObject({ status: 403 });
    const newBranch = await service.createCentre(limitedHeaders, {
      organizationId: orgs[0].id,
      name: "Second integration branch",
    });
    expect(newBranch.id).toBeTruthy();
    expect(limitedAdmin.id).not.toBe(employeeId);
  });
  it("rejects missing/wrong origins and enforces the database-backed IP login limit", async () => {
    const evil = new Request(`${settings.url}/api/auth/sign-in/username`, {
      method: "POST",
      headers: { origin: "https://evil.example.test", "content-type": "application/json" },
      body: JSON.stringify({ username: "employee.one", password }),
    });
    expect((await handleAuth(evil, auth, db)).status).toBe(403);
    const missing = new Request(`${settings.url}/api/auth/sign-in/username`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "employee.one", password }),
    });
    expect((await handleAuth(missing, auth, db)).status).toBe(403);
    const limitedAuth = buildAuth(db, { ...settings, rateLimit: true });
    for (let i = 0; i < 5; i++) {
      const response = await handleAuth(
        request(
          "/sign-in/username",
          { username: `ip-throttle-${i}`, password },
          new Headers({ "x-vercel-forwarded-for": "192.0.2.10" }),
        ),
        limitedAuth,
        db,
      );
      expect(response.status).toBe(401);
    }
    const response = await handleAuth(
      request(
        "/sign-in/username",
        { username: "ip-throttle-final", password },
        new Headers({ "x-vercel-forwarded-for": "192.0.2.10" }),
      ),
      limitedAuth,
      db,
    );
    expect(response.status).toBe(429);
  });
  it("supports explicit revocation, sign-out and persistent account throttling", async () => {
    await service.action(adminHeaders, employeeId, "revoke-sessions");
    await expect(resolveAccess(db, auth, employeeHeaders)).rejects.toMatchObject({ status: 401 });
    const loginResult = await login("employee.one", password);
    expect(loginResult.response.status).toBe(200);
    expect((await handleAuth(request("/sign-out", {}, loginResult.headers), auth, db)).status).toBe(
      200,
    );
    await expect(resolveAccess(db, auth, loginResult.headers)).rejects.toMatchObject({
      status: 401,
    });
    for (let i = 0; i < 10; i++) await login("throttle-test", "Incorrect-password-123");
    expect((await login("throttle-test", "Incorrect-password-123")).response.status).toBe(429);
  });
  it("rejects expired database sessions", async () => {
    const result = await login("employee.one", password);
    expect(result.response.status).toBe(200);
    await db
      .update(schema.session)
      .set({ expiresAt: new Date(Date.now() - 10000) })
      .where(eq(schema.session.userId, employeeId));
    await expect(resolveAccess(db, auth, result.headers)).rejects.toMatchObject({ status: 401 });
  });
});
