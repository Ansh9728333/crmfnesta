import { z } from "zod";
import { apiResponse } from "@/lib/http";
import { getManagementService } from "@/lib/management";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(r: Request, { params }: { params: Promise<{ type: string }> }) {
  return apiResponse(async () => {
    const q = new URL(r.url).searchParams,
      format = z.enum(["csv", "xlsx"]).parse(q.get("format")),
      result = await getManagementService().export(
        r.headers,
        (await params).type,
        Object.fromEntries(q),
        format,
      );
    return new Response(new Uint8Array(result.bytes), {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.name}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
