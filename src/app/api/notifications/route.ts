import { apiResponse, assertOrigin, jsonBody } from "@/lib/http";
import { getNotificationService } from "@/lib/management";
export const dynamic = "force-dynamic";
export async function GET(r: Request) {
  return apiResponse(() =>
    getNotificationService().list(r.headers, Object.fromEntries(new URL(r.url).searchParams)),
  );
}
export async function PATCH(r: Request) {
  return apiResponse(async () => {
    assertOrigin(r);
    return getNotificationService().change(r.headers, await jsonBody(r));
  });
}
