import "server-only";
import { getDb } from "../db";
import { getEnv } from "../env";
import { helpService } from "./service";
import { helpStorage } from "./storage";
export function getHelpService() {
  const e = getEnv();
  return helpService(
    getDb(),
    { url: e.BETTER_AUTH_URL, secret: e.BETTER_AUTH_SECRET },
    helpStorage(),
  );
}
