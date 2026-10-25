import "server-only";
import { getDb } from "../db";
import { getEnv } from "../env";
import { presalesService } from "./service";
export function getPresalesService() {
  const env = getEnv();
  return presalesService(getDb(), { url: env.BETTER_AUTH_URL, secret: env.BETTER_AUTH_SECRET });
}
