import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, username } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import type { Database } from "../db";
import * as schema from "../db/schema";

export type AuthSettings = { secret: string; url: string; rateLimit?: boolean };
export function buildAuth(db: Database, settings: AuthSettings) {
  return betterAuth({
    appName: "SiteFlow CRM",
    secret: settings.secret,
    baseURL: settings.url,
    logger: { disabled: true }, // Provider errors may include SQL parameters/PII.
    trustedOrigins: [settings.url],
    database: drizzleAdapter(db, { provider: "pg", schema, transaction: true }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
    },
    session: { expiresIn: 60 * 60 * 8, updateAge: 60 * 15, cookieCache: { enabled: false } },
    advanced: {
      useSecureCookies: settings.url.startsWith("https:"),
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: settings.url.startsWith("https:"),
      },
      ipAddress: { ipAddressHeaders: ["x-vercel-forwarded-for"], ipv6Subnet: 64 },
    },
    rateLimit: {
      enabled: settings.rateLimit ?? true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: { "/sign-in/username": { window: 300, max: 5 } },
    },
    plugins: [
      admin(),
      username({
        minUsernameLength: 3,
        maxUsernameLength: 40,
        validationOrder: { username: "post-normalization" },
        usernameValidator: (value) => /^[a-z0-9._-]+$/i.test(value),
        usernameNormalization: (value) => value.trim().toLowerCase(),
      }),
    ],
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const [profile] = await db
              .select()
              .from(schema.employeeProfiles)
              .where(eq(schema.employeeProfiles.userId, session.userId));
            if (!profile?.active)
              throw new APIError("FORBIDDEN", {
                message: "Access is disabled. Contact your administrator.",
              });
            const assignment = await db
              .select({ id: schema.employeeRoleAssignments.id })
              .from(schema.employeeRoleAssignments)
              .where(eq(schema.employeeRoleAssignments.userId, session.userId))
              .limit(1);
            if (!assignment.length)
              throw new APIError("FORBIDDEN", {
                message: "Access is disabled. Contact your administrator.",
              });
            return { data: session };
          },
          after: async (session) => {
            await db
              .update(schema.employeeProfiles)
              .set({ lastLoginAt: new Date() })
              .where(eq(schema.employeeProfiles.userId, session.userId));
          },
        },
      },
    },
  });
}
export type Auth = ReturnType<typeof buildAuth>;
