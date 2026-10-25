import { apiResponse, assertOrigin } from "@/lib/http";
import { getOrderService } from "@/lib/orders";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  return apiResponse(async () =>
    getOrderService().detail(
      request.headers,
      (await params).id,
      Object.fromEntries(new URL(request.url).searchParams),
    ),
  );
}
export async function POST(request: Request, { params }: Params) {
  return apiResponse(async () => {
    assertOrigin(request);
    return getOrderService().initialize(request.headers, (await params).id);
  });
}
