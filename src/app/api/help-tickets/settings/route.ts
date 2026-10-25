import { apiResponse, assertOrigin, jsonBody } from "@/lib/http";
import { getHelpService } from "@/lib/help-tickets";
export const dynamic = "force-dynamic";
export async function GET(r: Request) {
  return apiResponse(() =>
    getHelpService().policies(r.headers, new URL(r.url).searchParams.get("organizationId") ?? ""),
  );
}
export async function POST(r: Request) {
  return apiResponse(async () => {
    assertOrigin(r);
    return getHelpService().savePolicy(r.headers, await jsonBody(r));
  });
}
