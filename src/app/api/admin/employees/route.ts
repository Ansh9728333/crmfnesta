import { apiResponse, assertOrigin, jsonBody } from "@/lib/http";
import { getEmployeeService } from "@/lib/employees";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return apiResponse(() => getEmployeeService().list(request.headers));
}
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertOrigin(request);
    return getEmployeeService().create(request.headers, await jsonBody(request));
  });
}
