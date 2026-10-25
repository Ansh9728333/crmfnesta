import { z } from "zod";
import { apiResponse, assertOrigin, jsonBody } from "@/lib/http";
import { getLeadService } from "@/lib/leads";
export const runtime = "nodejs";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; followUpId: string }> },
) {
  return apiResponse(async () => {
    assertOrigin(request);
    const { id, followUpId } = await params;
    return getLeadService().completeFollowUp(
      request.headers,
      z.uuid().parse(id),
      z.uuid().parse(followUpId),
      await jsonBody(request),
    );
  });
}
