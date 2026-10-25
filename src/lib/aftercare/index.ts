import "server-only";
import { getDb } from "../db";
import { getEnv } from "../env";
import { aftercareService } from "./service";
export function getAftercareService() {
  const e = getEnv();
  return aftercareService(getDb(), { url: e.BETTER_AUTH_URL, secret: e.BETTER_AUTH_SECRET });
}
