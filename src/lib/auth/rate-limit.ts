import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Database } from "../db";
import { rateLimit } from "../db/schema";
export async function consumeAttempt(db: Database, key: string, maximum: number, windowMs: number) {
  const now = Date.now();
  const [attempt] = await db
    .insert(rateLimit)
    .values({ id: randomUUID(), key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`case when ${rateLimit.lastRequest} < ${now - windowMs} then 1 else ${rateLimit.count} + 1 end`,
        lastRequest: sql`case when ${rateLimit.lastRequest} < ${now - windowMs} then ${now} else ${rateLimit.lastRequest} end`,
      },
    })
    .returning();
  return attempt.count <= maximum;
}
