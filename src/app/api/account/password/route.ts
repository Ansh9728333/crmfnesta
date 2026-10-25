import { apiResponse, assertOrigin, jsonBody } from "@/lib/http";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { changeEmployeePassword } from "@/lib/auth/password";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertOrigin(request);
    const data = await jsonBody(request);
    const env = getEnv();
    return changeEmployeePassword(
      getDb(),
      { secret: env.BETTER_AUTH_SECRET, url: env.BETTER_AUTH_URL },
      request.headers,
      data,
    );
  });
}
