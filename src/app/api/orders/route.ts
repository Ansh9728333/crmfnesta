import { apiResponse } from "@/lib/http";
import { getOrderService } from "@/lib/orders";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return apiResponse(() =>
    getOrderService().list(request.headers, Object.fromEntries(new URL(request.url).searchParams)),
  );
}
