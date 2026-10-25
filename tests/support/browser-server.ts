// Isolated test infrastructure only. Never imported by src/ or production builds.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import * as schema from "../../src/lib/db/schema";
import { bootstrapAdmin } from "../../src/lib/auth/bootstrap";
import { buildAuth } from "../../src/lib/auth/config";
import { changeEmployeePassword } from "../../src/lib/auth/password";
import { employeeService } from "../../src/lib/employees/service";
import { browserAdmin, browserFinance, browserHelp } from "./browser-credentials";
import { leadService } from "../../src/lib/leads/service";
import { leadFormSchema } from "../../src/lib/leads/validation";
import { seedPostSalesBrowser } from "./seed-post-sales";

async function main() {
  const pg = await PGlite.create();
  await pg.exec("CREATE ROLE anon; CREATE ROLE authenticated;");
  const socket = new PGLiteSocketServer({
    db: pg,
    host: "127.0.0.1",
    port: 55439,
    maxConnections: 5,
  });
  await socket.start();
  const databaseUrl = "postgres://postgres:postgres@127.0.0.1:55439/postgres";
  const client = postgres(databaseUrl, { max: 1, prepare: false, ssl: false });
  const db = drizzle(client, { schema });
  const settings = { secret: randomUUID() + randomUUID(), url: "http://127.0.0.1:3100" };
  await migrate(db, { migrationsFolder: "./drizzle" });
  await bootstrapAdmin(db, settings, {
    name: "Browser Test Administrator",
    email: browserAdmin.email,
    username: browserAdmin.username,
    password: browserAdmin.initial,
    mobile: "+919000000001",
    centre: "Browser test branch",
  });
  const response = await buildAuth(db, settings).api.signInUsername({
    body: { username: browserAdmin.username, password: browserAdmin.initial },
    asResponse: true,
  });
  const headers = new Headers({
    cookie: response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; "),
    origin: settings.url,
  });
  await changeEmployeePassword(db, settings, headers, {
    currentPassword: browserAdmin.initial,
    newPassword: browserAdmin.password,
  });
  const active = await buildAuth(db, settings).api.signInUsername({
    body: { username: browserAdmin.username, password: browserAdmin.password },
    asResponse: true,
  });
  await seedPostSalesBrowser(
    db,
    settings,
    new Headers({
      origin: settings.url,
      cookie: active.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; "),
    }),
  );
  const seedHeaders = new Headers({
    origin: settings.url,
    cookie: active.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; "),
  });
  await employeeService(db, settings).create(seedHeaders, {
    name: "Browser Finance Administrator",
    username: browserFinance.username,
    email: browserFinance.email,
    password: browserFinance.initial,
    mobile: "9000000009",
    department: "Accounts",
    active: true,
    assignments: (await db.select().from(schema.centres)).map((c) => ({
      organizationId: c.organizationId,
      centreId: c.id,
      role: "Admin",
    })),
  });
  const financeLogin = await buildAuth(db, settings).api.signInUsername({
    body: { username: browserFinance.username, password: browserFinance.initial },
    asResponse: true,
  });
  await changeEmployeePassword(
    db,
    settings,
    new Headers({
      origin: settings.url,
      cookie: financeLogin.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; "),
    }),
    { currentPassword: browserFinance.initial, newPassword: browserFinance.password },
  );
  const [helpCentre] = await db.select().from(schema.centres);
  let helpCreatorId = "";
  for (const key of ["creator", "resolver"] as const) {
    const p = await employeeService(db, settings).create(seedHeaders, {
      name: `Browser Help ${key}`,
      username: browserHelp[key].username,
      email: browserHelp[key].email,
      password: browserHelp.password,
      mobile: "9000000098",
      department: "Help desk",
      active: true,
      assignments: [
        {
          organizationId: helpCentre.organizationId,
          centreId: helpCentre.id,
          role: key === "creator" ? "Sales Executive" : "Service Engineer",
        },
      ],
    });
    if (key === "creator") helpCreatorId = p.id;
  }
  await leadService(db, settings).create(
    seedHeaders,
    leadFormSchema.parse({
      organizationId: helpCentre.organizationId,
      centreId: helpCentre.id,
      assignedTo: helpCreatorId,
      clientName: "Browser Help Customer",
      mobile: "9876500097",
      projectName: "Browser Help Project",
      siteAddress: "Disposable help ticket browser test site",
    }),
  );
  await client.end();
  const app = spawn(
    process.execPath,
    [
      resolve("node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3100",
    ],
    {
      windowsHide: true,
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        DIRECT_URL: databaseUrl,
        DATABASE_SSL_CA: "",
        VERCEL_OIDC_TOKEN: "",
        BETTER_AUTH_SECRET: settings.secret,
        BETTER_AUTH_URL: settings.url,
        NEXT_PUBLIC_APP_URL: settings.url,
        SUPABASE_URL: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
      },
    },
  );
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    app.kill();
    await socket.stop();
    await pg.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  app.on("exit", async (code) => {
    if (!stopping) {
      await socket.stop();
      await pg.close();
      process.exit(code ?? 1);
    }
  });
}
main().catch(() => {
  console.error("Isolated authenticated browser-test server could not start.");
  process.exit(1);
});
