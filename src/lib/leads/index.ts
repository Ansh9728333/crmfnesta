import "server-only";
import { getDb } from "../db";
import { getEnv } from "../env";
import { leadService } from "./service";
export function getLeadService() {
  const env = getEnv();
  return leadService(getDb(), { secret: env.BETTER_AUTH_SECRET, url: env.BETTER_AUTH_URL });
}
