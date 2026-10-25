import { apiResponse, assertOrigin, jsonBody } from "@/lib/http";
import { getEmployeeService } from "@/lib/employees";
export const runtime = "nodejs";
export async function PUT(request: Request) {
  return apiResponse(async () => {
    assertOrigin(request);
    return getEmployeeService().updatePermissions(request.headers, await jsonBody(request));
  });
}
