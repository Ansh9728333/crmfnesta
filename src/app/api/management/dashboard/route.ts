import { apiResponse } from "@/lib/http";
import { getManagementService } from "@/lib/management";
export const dynamic = "force-dynamic";
export async function GET(r: Request) {
  return apiResponse(() =>
    getManagementService().dashboard(r.headers, Object.fromEntries(new URL(r.url).searchParams)),
  );
}
