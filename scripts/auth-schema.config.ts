// Tooling only: generates the library-owned tables without connecting to a database.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, username } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
export const auth = betterAuth({
  secret: "schema-generation-only-not-a-runtime-secret-000000",
  database: drizzleAdapter(
    drizzle(postgres("postgres://localhost/siteflow_schema_generation", { max: 1 })),
    { provider: "pg" },
  ),
  emailAndPassword: { enabled: true, disableSignUp: true },
  rateLimit: { enabled: true, storage: "database" },
  plugins: [admin(), username()],
});
