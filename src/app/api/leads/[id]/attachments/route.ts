import { apiResponse, assertOrigin } from "@/lib/http";
import { AccessError } from "@/lib/auth/access";
import { getPresalesService } from "@/lib/presales";
import { privateVisitStore } from "@/lib/presales/storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiResponse(async () => {
    assertOrigin(request);
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
      throw new AccessError(415, "Multipart upload required");
    const reader = request.body?.getReader();
    if (!reader) throw new AccessError(400, "File required");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4 * 1024 * 1024 + 16384) {
        await reader.cancel();
        throw new AccessError(413, "Upload exceeds 4 MiB");
      }
      chunks.push(value);
    }
    const body = Buffer.concat(chunks),
      form = await new Response(body, {
        headers: { "Content-Type": request.headers.get("content-type")! },
      }).formData(),
      file = form.get("file");
    if (!(file instanceof File)) throw new AccessError(400, "File required");
    const appointmentId = form.get("appointmentId");
    return getPresalesService().upload(
      request.headers,
      (await params).id,
      {
        name: file.name,
        contentType: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
        appointmentId:
          typeof appointmentId === "string" && appointmentId ? appointmentId : undefined,
      },
      privateVisitStore,
    );
  });
}
