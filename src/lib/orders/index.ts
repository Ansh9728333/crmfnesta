import "server-only";
import { getDb } from "../db";
import { getEnv } from "../env";
import { orderService } from "./service";
export function getOrderService() {
  const env = getEnv();
  return orderService(getDb(), { url: env.BETTER_AUTH_URL, secret: env.BETTER_AUTH_SECRET });
}
