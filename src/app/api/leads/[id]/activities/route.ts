import { z } from "zod";
import { apiResponse, assertOrigin, jsonBody } from "@/lib/http";
import { getLeadService } from "@/lib/leads";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiResponse(async () => {
    assertOrigin(request);
    return getLeadService().note(
      request.headers,
      z.uuid().parse((await params).id),
      await jsonBody(request),
    );
  });
}
