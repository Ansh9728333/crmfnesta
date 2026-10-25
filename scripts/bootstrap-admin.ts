import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
async function main() {
  const { bootstrapAdmin } = await import("../src/lib/auth/bootstrap");
  const { getDb } = await import("../src/lib/db");
  const { getEnv } = await import("../src/lib/env");
  const env = getEnv();
  const required = (name: string) => {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required`);
    return value;
  };
  await bootstrapAdmin(
    getDb(),
    { secret: env.BETTER_AUTH_SECRET, url: env.BETTER_AUTH_URL },
    {
      name: required("BOOTSTRAP_ADMIN_NAME"),
      username: required("BOOTSTRAP_ADMIN_USERNAME"),
      email: required("BOOTSTRAP_ADMIN_EMAIL"),
      password: required("BOOTSTRAP_ADMIN_PASSWORD"),
      mobile: required("BOOTSTRAP_ADMIN_MOBILE"),
      centre: required("BOOTSTRAP_CENTRE"),
    },
  );
  console.log(
    "Administrator created with the configured password. Remove all BOOTSTRAP_* environment variables now.",
  );
}
main()
  .then(() => process.exit(0))
  .catch(() => {
    console.error(
      "Bootstrap failed. Check configuration, migration status, and whether a user already exists. No credentials were logged.",
    );
    process.exit(1);
  });
