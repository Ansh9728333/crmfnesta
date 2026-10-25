import { z } from "zod";
import { apiResponse, assertOrigin } from "@/lib/http";
import { getCommerceService } from "@/lib/commerce";
import { readPrivateUpload } from "@/lib/documents/upload";
import { privateVisitStore } from "@/lib/presales/storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(r: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiResponse(async () => {
    assertOrigin(r);
    const url = new URL(r.url),
      kind = z.enum(["payment", "dispatch", "delivery"]).parse(url.searchParams.get("kind")),
      target = z.uuid().parse(url.searchParams.get("target"));
    return getCommerceService().upload(
      r.headers,
      (await params).id,
      kind,
      target,
      await readPrivateUpload(r),
      privateVisitStore,
    );
  });
}
