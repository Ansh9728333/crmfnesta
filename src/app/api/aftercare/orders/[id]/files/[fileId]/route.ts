import { apiResponse } from "@/lib/http";
import { getAftercareService } from "@/lib/aftercare";
import { privateVisitStore } from "@/lib/presales/storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  r: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  return apiResponse(async () => {
    const { id, fileId } = await params;
    return getAftercareService().download(r.headers, id, fileId, privateVisitStore);
  });
}
