import { z } from "zod";
const appUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.origin === value &&
    (url.protocol === "https:" ||
      (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
  );
}, "Use an HTTPS origin (HTTP is allowed only on loopback)");
export const authEnvSchema = z
  .object({
    DATABASE_URL: z
      .url()
      .refine(
        (value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol),
        "Use a PostgreSQL connection URL",
      ),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: appUrl,
    NEXT_PUBLIC_APP_URL: appUrl,
  })
  .refine(
    (v) => v.BETTER_AUTH_URL === v.NEXT_PUBLIC_APP_URL,
    "App and authentication origins must match",
  );
export function getEnv() {
  const result = authEnvSchema.safeParse(process.env);
  if (!result.success)
    throw new Error(
      "Authentication is not configured. Check the server environment against .env.example.",
    );
  return result.data;
}
