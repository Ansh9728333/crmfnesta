import { apiResponse } from "@/lib/http";
import { getHelpService } from "@/lib/help-tickets";
export const dynamic = "force-dynamic";
export async function GET(r: Request) {
  return apiResponse(() => {
    const q = Object.fromEntries(new URL(r.url).searchParams);
    return q.id ? getHelpService().context(r.headers, q) : getHelpService().sources(r.headers, q);
  });
}
