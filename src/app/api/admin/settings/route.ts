import { apiResponse, assertOrigin, jsonBody } from "@/lib/http";
import { getSettingsService } from "@/lib/management";
export const dynamic = "force-dynamic";
export async function GET(r: Request) {
  return apiResponse(() =>
    getSettingsService().list(r.headers, Object.fromEntries(new URL(r.url).searchParams)),
  );
}
export async function POST(r: Request) {
  return apiResponse(async () => {
    assertOrigin(r);
    return getSettingsService().save(r.headers, await jsonBody(r));
  });
}
