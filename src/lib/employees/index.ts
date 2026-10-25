import "server-only";
import { employeeService } from "./service";
import { getDb } from "../db";
import { getEnv } from "../env";
export function getEmployeeService() {
  const env = getEnv();
  return employeeService(getDb(), { secret: env.BETTER_AUTH_SECRET, url: env.BETTER_AUTH_URL });
}
