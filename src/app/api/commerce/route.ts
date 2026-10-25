import { apiResponse } from "@/lib/http";
import { getCommerceService } from "@/lib/commerce";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(r: Request) {
  return apiResponse(() => {
    const u = new URL(r.url);
    return getCommerceService().list(
      r.headers,
      u.searchParams.get("mode") === "dispatch" ? "dispatch" : "payments",
      Object.fromEntries(u.searchParams),
    );
  });
}
