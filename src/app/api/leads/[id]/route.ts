import { z } from "zod";
import { apiResponse, assertOrigin, jsonBody } from "@/lib/http";
import { getLeadService } from "@/lib/leads";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  return apiResponse(async () =>
    getLeadService().detail(
      request.headers,
      z.uuid().parse((await params).id),
      z.coerce
        .number()
        .int()
        .min(1)
        .max(100000)
        .parse(new URL(request.url).searchParams.get("activityPage") ?? 1),
      z.coerce
        .number()
        .int()
        .min(1)
        .max(100000)
        .parse(new URL(request.url).searchParams.get("followUpPage") ?? 1),
    ),
  );
}
export async function PATCH(request: Request, { params }: Params) {
  return apiResponse(async () => {
    assertOrigin(request);
    return getLeadService().update(
      request.headers,
      z.uuid().parse((await params).id),
      await jsonBody(request),
    );
  });
}
export async function DELETE(request: Request, { params }: Params) {
  return apiResponse(async () => {
    assertOrigin(request);
    return getLeadService().archive(
      request.headers,
      z.uuid().parse((await params).id),
      await jsonBody(request),
    );
  });
}
