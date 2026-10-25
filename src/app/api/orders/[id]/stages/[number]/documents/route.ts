import { apiResponse, assertOrigin } from "@/lib/http";
import { getOrderService } from "@/lib/orders";
import { stageNumber } from "@/lib/orders/validation";
import { readPrivateUpload } from "@/lib/documents/upload";
import { privateVisitStore as privateOrderStore } from "@/lib/presales/storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; number: string }> },
) {
  return apiResponse(async () => {
    assertOrigin(request);
    const { id, number } = await params;
    return getOrderService().upload(
      request.headers,
      id,
      stageNumber.parse(number),
      {
        ...(await readPrivateUpload(request)),
        requirementId: new URL(request.url).searchParams.get("requirementId") ?? undefined,
      },
      privateOrderStore,
    );
  });
}
