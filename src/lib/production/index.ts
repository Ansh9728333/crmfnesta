import "server-only";
import { getDb } from "../db";
import { getEnv } from "../env";
import { productionService } from "./service";
export function getProductionService() {
  const env = getEnv();
  return productionService(getDb(), { url: env.BETTER_AUTH_URL, secret: env.BETTER_AUTH_SECRET });
}
