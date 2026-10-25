import { eq, sql } from "drizzle-orm";
import type { Database } from "../db";
import { auditLogs, employeeProfiles } from "../db/schema";
import { AccessError, resolveAccess } from "./access";
import { buildAuth, type AuthSettings } from "./config";
import { changePasswordSchema } from "./validation";
import { consumeAttempt } from "./rate-limit";
export async function changeEmployeePassword(
  db: Database,
  settings: AuthSettings,
  headers: Headers,
  input: unknown,
) {
  const data = changePasswordSchema.parse(input);
  const preliminary = await resolveAccess(db, buildAuth(db, settings), headers, true);
  // Outside the password transaction so failed verification does not roll back limits.
  if (!(await consumeAttempt(db, `password-change:${preliminary.user.id}`, 5, 300000)))
    throw new AccessError(429, "Too many password-change attempts. Try again in five minutes.");
  return db.transaction(async (transaction) => {
    const tx = transaction as unknown as Database;
    await tx.execute(sql`select pg_advisory_xact_lock(73190021)`);
    const auth = buildAuth(tx, settings);
    const access = await resolveAccess(tx, auth, headers, true);
    const response = await auth.api.changePassword({
      headers,
      body: { ...data, revokeOtherSessions: true },
      asResponse: true,
    });
    if (!response.ok)
      throw new AccessError(400, "Password could not be changed. Check your current password.");
    await tx
      .update(employeeProfiles)
      .set({ mustChangePassword: false })
      .where(eq(employeeProfiles.userId, access.user.id));
    await tx
      .insert(auditLogs)
      .values({ actorId: access.user.id, targetId: access.user.id, action: "password.changed" });
    return response;
  });
}
