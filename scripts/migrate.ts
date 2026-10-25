import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { databaseTls } from "../src/lib/db/tls";
config({ path: ".env.local", quiet: true });
async function main() {
  const url = process.env.DIRECT_URL;
  if (!url) throw new Error("DIRECT_URL is required");
  const client = postgres(url, {
    prepare: false,
    max: 1,
    ssl: databaseTls(url, process.env.DATABASE_SSL_CA),
    connect_timeout: 10,
  });
  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    console.log("Database migrations applied.");
  } finally {
    await client.end();
  }
}
main().catch(() => {
  console.error(
    "Migration failed. Check DIRECT_URL, connectivity and database permissions. Credentials were not logged.",
  );
  process.exitCode = 1;
});
