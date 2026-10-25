import "server-only";
import { getPrivateStorage, signPrivateDocument } from "../documents/storage";
import type { FileStore } from "./service";
export const privateVisitStore: FileStore = {
  async upload(path, bytes, type) {
    const { client, bucket } = getPrivateStorage();
    const info = await client.storage.getBucket(bucket);
    if (info.error || !info.data || info.data.public)
      throw new Error("Private storage unavailable");
    const result = await client.storage
      .from(bucket)
      .upload(path, bytes, { contentType: type, upsert: false });
    if (result.error) throw new Error("Upload failed");
  },
  async remove(path) {
    const { client, bucket } = getPrivateStorage();
    const result = await client.storage.from(bucket).remove([path]);
    if (result.error) throw new Error("Upload cleanup failed");
  },
  sign: signPrivateDocument,
};
