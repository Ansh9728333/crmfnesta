import { apiResponse, assertOrigin, jsonBody } from "@/lib/http";
import { getHelpService } from "@/lib/help-tickets";
import { z } from "zod";
export const dynamic = "force-dynamic";
export async function POST(r: Request) {
  return apiResponse(async () => {
    assertOrigin(r);
    return getHelpService().prepareFile(r.headers, await jsonBody(r));
  });
}
export async function PATCH(r: Request) {
  return apiResponse(async () => {
    assertOrigin(r);
    const i = z
      .object({ id: z.uuid() })
      .strict()
      .parse(await jsonBody(r));
    return getHelpService().finalizeFile(r.headers, i.id);
  });
}
export async function GET(r: Request) {
  return apiResponse(() =>
    getHelpService().download(r.headers, new URL(r.url).searchParams.get("id") ?? ""),
  );
}
