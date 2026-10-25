// Deployment preflight only. Metadata reads cannot modify target data/schema.
import { config } from "dotenv";
import postgres from "postgres";
import { databaseTls } from "../src/lib/db/tls";
import { readMigrationFiles } from "drizzle-orm/migrator";

config({ path: ".env.local", quiet: true });
async function main() {
  const url = process.env.DIRECT_URL;
  if (!url || url.includes("REPLACE_WITH") || url.includes("[YOUR-PASSWORD]"))
    throw new Error("DATABASE_CONFIGURATION_REQUIRED");
  const client = postgres(url, {
    max: 1,
    prepare: false,
    ssl: databaseTls(url, process.env.DATABASE_SSL_CA),
    connect_timeout: 10,
    idle_timeout: 5,
    onnotice: () => undefined,
  });
  try {
    const result = await client.begin("read only", async (tx) => {
      const [version] = await tx`select current_setting('server_version') as version`;
      const tables = await tx`select table_name from information_schema.tables
        where table_schema='public' and table_type='BASE TABLE' order by table_name`;
      const [ledger] =
        await tx`select to_regclass('drizzle.__drizzle_migrations') is not null as present`;
      const applied = ledger.present
        ? await tx`select hash from drizzle.__drizzle_migrations order by created_at`
        : [];
      const expected = readMigrationFiles({ migrationsFolder: "./drizzle" });
      const security = await tx`select c.relname as table_name, c.relrowsecurity as rls,
        has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as anon_access,
        has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as authenticated_access
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relkind='r' order by c.relname`;
      const [storage] = await tx`select exists(select 1 from pg_policies where schemaname='storage'
        and tablename='objects' and policyname='siteflow_documents_server_only'
        and permissive='RESTRICTIVE') as guarded`;
      const [helpStorage] =
        await tx`select exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='siteflow_help_files_server_only' and permissive='RESTRICTIVE') as guarded`;
      return {
        connected: true,
        serverVersion: version.version,
        publicTables: tables.map((table) => table.table_name),
        migrationLedgerPresent: ledger.present,
        appliedMigrations: applied.length,
        appliedPrefixHashesMatch: applied.every((row, index) => row.hash === expected[index]?.hash),
        pendingMigrations: Math.max(0, expected.length - applied.length),
        migrationHashesMatch:
          applied.length === expected.length &&
          applied.every((row, index) => row.hash === expected[index].hash),
        tablesMissingRls: security.filter((row) => !row.rls).map((row) => row.table_name),
        browserGrantedTables: security
          .filter((row) => row.anon_access || row.authenticated_access)
          .map((row) => row.table_name),
        privateBucketPolicyPresent: storage.guarded,
        privateHelpBucketPolicyPresent: helpStorage.guarded,
      };
    });
    console.log(JSON.stringify(result));
  } finally {
    await client.end({ timeout: 5 });
  }
}
main().catch((error: unknown) => {
  // Never print provider errors, credentials or connection URLs.
  const candidate =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "CONNECTION_FAILED";
  const code = /^[A-Z0-9_]{2,64}$/.test(candidate) ? candidate : "CONNECTION_FAILED";
  console.error(JSON.stringify({ connected: false, code }));
  process.exitCode = 1;
});
