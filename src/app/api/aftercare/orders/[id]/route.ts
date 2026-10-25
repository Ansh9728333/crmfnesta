import { apiResponse, assertOrigin, jsonBody } from "@/lib/http";
import { getAftercareService } from "@/lib/aftercare";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(r: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiResponse(async () =>
    getAftercareService().detail(
      r.headers,
      (await params).id,
      Number(new URL(r.url).searchParams.get("historyPage") ?? 1),
    ),
  );
}
export async function PATCH(r: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiResponse(async () => {
    assertOrigin(r);
    return getAftercareService().change(r.headers, (await params).id, await jsonBody(r));
  });
}
