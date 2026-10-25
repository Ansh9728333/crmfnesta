import { apiResponse } from "@/lib/http";
import { getProductionService } from "@/lib/production";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(r: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiResponse(async () => getProductionService().planning(r.headers, (await params).id));
}
