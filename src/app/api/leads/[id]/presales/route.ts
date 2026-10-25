import { z } from "zod";
import { apiResponse, assertOrigin, jsonBody } from "@/lib/http";
import { getPresalesService } from "@/lib/presales";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Params) {
  return apiResponse(async () =>
    getPresalesService().detail(
      request.headers,
      (await params).id,
      z.coerce
        .number()
        .int()
        .min(1)
        .max(100000)
        .parse(new URL(request.url).searchParams.get("page") ?? 1),
    ),
  );
}
export async function POST(request: Request, { params }: Params) {
  return apiResponse(async () => {
    assertOrigin(request);
    const { action, data } = z
        .object({
          action: z.enum([
            "appointment",
            "quotation",
            "decision",
            "engagement",
            "convert",
            "complete-stage",
          ]),
          data: z.unknown(),
        })
        .parse(await jsonBody(request)),
      id = (await params).id,
      service = getPresalesService();
    switch (action) {
      case "complete-stage":
        return service.completeStage(request.headers, id, data);
      case "appointment":
        return service.appointment(request.headers, id, data);
      case "quotation":
        return service.quotation(request.headers, id, data);
      case "decision":
        return service.decide(request.headers, id, data);
      case "engagement":
        return service.engagement(request.headers, id, data);
      case "convert":
        return service.convert(request.headers, id, data);
    }
  });
}
