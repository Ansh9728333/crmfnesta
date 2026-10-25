import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { getEnv } from "../env";
import { databaseTls } from "./tls";

export type Database = ReturnType<typeof drizzle<typeof schema>>;
let database: Database | undefined;
// Next.js can load SSR and route-handler bundles separately in one worker.
// Share the pool, not query results, so each bundle does not open another pool.
const runtime = globalThis as typeof globalThis & {
  siteflowPostgresClient?: ReturnType<typeof postgres>;
};
export function getDb(): Database {
  if (!database) {
    const { DATABASE_URL } = getEnv();
    const client =
      runtime.siteflowPostgresClient ??
      postgres(DATABASE_URL, {
        prepare: false,
        max: 1,
        ssl: databaseTls(DATABASE_URL, process.env.DATABASE_SSL_CA),
        connect_timeout: 10,
        idle_timeout: 20,
      });
    runtime.siteflowPostgresClient = client;
    database = drizzle(client, { schema });
  }
  return database;
}
