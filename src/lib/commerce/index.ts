import "server-only";
import { getDb } from "../db";
import { getEnv } from "../env";
import { commerceService } from "./service";
export function getCommerceService() {
  const e = getEnv();
  return commerceService(getDb(), { url: e.BETTER_AUTH_URL, secret: e.BETTER_AUTH_SECRET });
}
