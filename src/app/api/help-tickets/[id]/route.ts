import { apiResponse, assertOrigin, jsonBody } from "@/lib/http";
import { getHelpService } from "@/lib/help-tickets";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(r: Request, c: Context) {
  return apiResponse(async () => getHelpService().detail(r.headers, (await c.params).id));
}
export async function PATCH(r: Request, c: Context) {
  return apiResponse(async () => {
    assertOrigin(r);
    return getHelpService().change(r.headers, (await c.params).id, await jsonBody(r));
  });
}
