import { apiResponse } from "@/lib/http";
import { getManagementService } from "@/lib/management";
export const dynamic = "force-dynamic";
export async function GET(r: Request, { params }: { params: Promise<{ type: string }> }) {
  return apiResponse(async () =>
    getManagementService().report(
      r.headers,
      (await params).type,
      Object.fromEntries(new URL(r.url).searchParams),
    ),
  );
}
