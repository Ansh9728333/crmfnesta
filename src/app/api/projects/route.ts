import { apiResponse, assertOrigin, jsonBody } from "@/lib/http";
import { getLeadService } from "@/lib/leads";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return apiResponse(() =>
    getLeadService().projects(
      request.headers,
      Object.fromEntries(new URL(request.url).searchParams),
    ),
  );
}
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertOrigin(request);
    return getLeadService().createProject(request.headers, await jsonBody(request));
  });
}
