import { apiResponse, assertOrigin, jsonBody } from "@/lib/http";
import { getHelpService } from "@/lib/help-tickets";
export const dynamic = "force-dynamic";
export async function GET(r: Request) {
  return apiResponse(() =>
    getHelpService().list(r.headers, Object.fromEntries(new URL(r.url).searchParams)),
  );
}
export async function POST(r: Request) {
  return apiResponse(async () => {
    assertOrigin(r);
    return getHelpService().create(r.headers, await jsonBody(r));
  });
}
