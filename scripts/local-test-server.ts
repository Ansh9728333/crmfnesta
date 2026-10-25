// Explicit local test infrastructure. Never imported by src/ or deployed runtimes.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import * as schema from "../src/lib/db/schema";
import { bootstrapAdmin } from "../src/lib/auth/bootstrap";
import { createEmployeeSchema } from "../src/lib/auth/validation";

const directory = resolve(".local/siteflow-test");
const origin = "http://localhost:3000";
const identitySchema = createEmployeeSchema
  .pick({ name: true, email: true, mobile: true, username: true })
  .extend({ password: z.string().min(12).optional(), authSecret: z.string().min(32).optional() });

async function main() {
  if (process.env.VERCEL || process.env.CI)
    throw new Error("Local test infrastructure cannot run on hosted environments");
  await access(resolve(".next/BUILD_ID"));
  await mkdir(directory, { recursive: true });
  const configPath = resolve(directory, "admin.json");
  const input = identitySchema.parse(JSON.parse(await readFile(configPath, "utf8")));
  const config = {
    ...input,
    password: input.password ?? randomBytes(18).toString("base64url"),
    authSecret: input.authSecret ?? randomBytes(48).toString("base64url"),
  };
  // Store secrets only in the explicitly ignored local test directory, never logs.
  await writeFile(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
  const pg = await PGlite.create(resolve(directory, "database"));
  let socket: PGLiteSocketServer | undefined;
  let client: ReturnType<typeof postgres> | undefined;
  try {
    await pg.exec(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
    END $$;`);
    socket = new PGLiteSocketServer({ db: pg, host: "127.0.0.1", port: 55440, maxConnections: 5 });
    await socket.start();
    // The embedded test engine is loopback-only; its socket is trusted local test
    // infrastructure, not a password-authenticated production database endpoint.
    const databaseUrl = "postgres://postgres@127.0.0.1:55440/postgres";
    client = postgres(databaseUrl, {
      max: 1,
      prepare: false,
      ssl: false,
      onnotice: () => undefined,
    });
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    const existing = await db.select({ id: schema.user.id }).from(schema.user).limit(1);
    if (!existing.length) {
      await bootstrapAdmin(
        db,
        { secret: config.authSecret, url: origin },
        {
          name: config.name,
          email: config.email,
          mobile: config.mobile,
          username: config.username,
          password: config.password,
          centre: "Local test branch",
        },
      );
      await writeFile(
        resolve(directory, "ADMIN_LOGIN.txt"),
        [
          "LOCAL TEST ACCOUNT ONLY",
          `URL: ${origin}/login`,
          `Username: ${config.username}`,
          `Temporary password: ${config.password}`,
          "Change this password at first login. After changing it, this temporary password no longer works.",
          "No email or SMS was sent. Do not reuse this password outside this isolated test instance.",
        ].join("\n"),
        { mode: 0o600 },
      );
    }
    await client.end();
    client = undefined;
    const app = spawn(
      process.execPath,
      [
        resolve("node_modules/next/dist/bin/next"),
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        "3000",
      ],
      {
        windowsHide: true,
        stdio: "inherit",
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          DIRECT_URL: "",
          DATABASE_SSL_CA: "",
          BETTER_AUTH_SECRET: config.authSecret,
          BETTER_AUTH_URL: origin,
          NEXT_PUBLIC_APP_URL: origin,
          SUPABASE_URL: "",
          SUPABASE_SERVICE_ROLE_KEY: "",
          SUPABASE_STORAGE_BUCKET: "",
        },
      },
    );
    console.log("Local test database is persistent in .local/siteflow-test/database.");
    console.log("Admin login details: .local/siteflow-test/ADMIN_LOGIN.txt (not printed).");
    console.log("This isolated test instance has no Supabase file Storage integration.");
    let stopping = false;
    const stop = async (code = 0) => {
      if (stopping) return;
      stopping = true;
      if (app.pid && app.exitCode === null && app.signalCode === null) {
        const exited = new Promise<void>((done) => app.once("exit", () => done()));
        app.kill();
        await exited;
      }
      await socket!.stop();
      await pg.close();
      process.exit(code);
    };
    process.once("SIGINT", () => {
      void stop();
    });
    process.once("SIGTERM", () => {
      void stop();
    });
    app.once("error", () => {
      void stop(1);
    });
    app.once("exit", (code) => {
      void stop(code ?? 1);
    });
  } catch {
    await client?.end().catch(() => undefined);
    await socket?.stop().catch(() => undefined);
    await pg.close();
    throw new Error("Local test initialization failed");
  }
}

main().catch(() => {
  console.error(
    "Local test startup failed. Check .local/siteflow-test/admin.json, the production build and ports 3000/55440. No credentials were logged.",
  );
  process.exitCode = 1;
});
