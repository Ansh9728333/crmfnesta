import { apiResponse, assertOrigin, jsonBody } from "@/lib/http";
import { getLeadService } from "@/lib/leads";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return apiResponse(() => {
    const query = Object.fromEntries(new URL(request.url).searchParams);
    const service = getLeadService();
    return query.mode === "board"
      ? service.board(request.headers, query)
      : query.mode === "summary"
        ? service.summary(request.headers, query)
        : query.mode === "directory"
          ? service.directory(request.headers)
          : service.list(request.headers, query);
  });
}
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertOrigin(request);
    return getLeadService().create(request.headers, await jsonBody(request));
  });
}
