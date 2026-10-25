import { apiResponse, assertOrigin, jsonBody } from "@/lib/http";
import { getProductionService } from "@/lib/production";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(r: Request) {
  return apiResponse(() =>
    getProductionService().list(r.headers, Object.fromEntries(new URL(r.url).searchParams)),
  );
}
export async function POST(r: Request) {
  return apiResponse(async () => {
    assertOrigin(r);
    return getProductionService().create(r.headers, await jsonBody(r));
  });
}
