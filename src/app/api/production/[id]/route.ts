import { apiResponse, assertOrigin, jsonBody } from "@/lib/http";
import { getProductionService } from "@/lib/production";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(r: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiResponse(async () =>
    getProductionService().detail(
      r.headers,
      (await params).id,
      new URL(r.url).searchParams.get("historyPage") ?? 1,
    ),
  );
}
export async function PATCH(r: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiResponse(async () => {
    assertOrigin(r);
    return getProductionService().change(r.headers, (await params).id, await jsonBody(r));
  });
}
