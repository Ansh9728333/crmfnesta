import { apiResponse } from "@/lib/http";
import { getOrderService } from "@/lib/orders";
import { privateVisitStore } from "@/lib/presales/storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  return apiResponse(async () => {
    const { id, fileId } = await params;
    return getOrderService().download(request.headers, id, fileId, privateVisitStore);
  });
}
