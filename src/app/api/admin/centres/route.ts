import { apiResponse, assertOrigin, jsonBody } from "@/lib/http";
import { getEmployeeService } from "@/lib/employees";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertOrigin(request);
    return getEmployeeService().createCentre(request.headers, await jsonBody(request));
  });
}
