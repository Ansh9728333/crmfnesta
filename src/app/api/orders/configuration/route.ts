import { apiResponse, assertOrigin, jsonBody } from "@/lib/http";
import { getOrderService } from "@/lib/orders";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return apiResponse(() => getOrderService().configuration(request.headers));
}
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertOrigin(request);
    return getOrderService().configure(request.headers, await jsonBody(request));
  });
}
