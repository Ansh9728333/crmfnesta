import "server-only";
import { getPrivateStorage } from "../documents/storage";
import type { HelpStore } from "./service";
export const helpBucket = "siteflow-help-ticket-files";
export function helpStorage(): HelpStore {
  const storage = () => getPrivateStorage().client.storage.from(helpBucket);
  return {
    async prepare(path) {
      const client = getPrivateStorage().client;
      const info = await client.storage.getBucket(helpBucket);
      if (info.error || info.data?.public || Number(info.data?.file_size_limit) !== 10485760)
        throw new Error("Private help storage unavailable");
      const { data, error } = await storage().createSignedUploadUrl(path, { upsert: false });
      if (error || !data) throw new Error("Help upload unavailable");
      return { signedUrl: data.signedUrl };
    },
    async read(path) {
      const { data, error } = await storage().download(path);
      if (error || !data) throw new Error("Help upload not found");
      if (data.size > 10485760) throw new Error("Help upload too large");
      return new Uint8Array(await data.arrayBuffer());
    },
    async sign(path) {
      const info = await getPrivateStorage().client.storage.getBucket(helpBucket);
      if (info.error || info.data?.public) throw new Error("Private help storage unavailable");
      const { data, error } = await storage().createSignedUrl(path, 60, { download: true });
      if (error || !data) throw new Error("Help download unavailable");
      return data.signedUrl;
    },
  };
}
