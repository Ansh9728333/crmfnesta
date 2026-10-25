import { apiResponse, assertOrigin, jsonBody } from "@/lib/http";
import { getOrderService } from "@/lib/orders";
import { stageNumber } from "@/lib/orders/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; number: string }> },
) {
  return apiResponse(async () => {
    assertOrigin(request);
    const { id, number } = await params;
    return getOrderService().transition(
      request.headers,
      id,
      stageNumber.parse(number),
      await jsonBody(request),
    );
  });
}
