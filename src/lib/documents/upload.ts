import "server-only";
import { AccessError } from "../auth/access";
export async function readPrivateUpload(request: Request) {
  const contentType = request.headers.get("content-type");
  if (!contentType?.startsWith("multipart/form-data"))
    throw new AccessError(415, "Multipart upload required");
  const reader = request.body?.getReader();
  if (!reader) throw new AccessError(400, "File required");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 4194304 + 16384) {
      await reader.cancel();
      throw new AccessError(413, "Upload exceeds 4 MiB");
    }
    chunks.push(value);
  }
  const form = await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": contentType },
    }).formData(),
    file = form.get("file");
  if (!(file instanceof File)) throw new AccessError(400, "File required");
  return {
    name: file.name,
    contentType: file.type,
    bytes: new Uint8Array(await file.arrayBuffer()),
  };
}
