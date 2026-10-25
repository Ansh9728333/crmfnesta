import { apiResponse } from "@/lib/http";
import { getAftercareService } from "@/lib/aftercare";
export const dynamic = "force-dynamic";
export async function GET(r: Request) {
  return apiResponse(() => {
    const q = new URL(r.url).searchParams;
    return getAftercareService().list(
      r.headers,
      Object.fromEntries(q),
      q.get("mode") === "service" ? "service" : "installations",
    );
  });
}
