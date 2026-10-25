import { z } from "zod";
import { apiResponse, assertOrigin, jsonBody } from "@/lib/http";
import { getEmployeeService } from "@/lib/employees";
export const runtime = "nodejs";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiResponse(async () => {
    assertOrigin(request);
    return getEmployeeService().update(request.headers, (await params).id, await jsonBody(request));
  });
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiResponse(async () => {
    assertOrigin(request);
    const data = z
      .object({
        action: z.enum(["activate", "deactivate", "reset-password", "revoke-sessions"]),
        password: z.string().optional(),
      })
      .parse(await jsonBody(request));
    return getEmployeeService().action(
      request.headers,
      (await params).id,
      data.action,
      data.password,
    );
  });
}
