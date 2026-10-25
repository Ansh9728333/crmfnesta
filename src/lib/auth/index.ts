import "server-only";
import { getDb } from "../db";
import { getEnv } from "../env";
import { buildAuth, type Auth } from "./config";
let auth: Auth | undefined;
export function getAuth() {
  const env = getEnv();
  return (auth ??= buildAuth(getDb(), {
    secret: env.BETTER_AUTH_SECRET,
    url: env.BETTER_AUTH_URL,
  }));
}
