import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
export function getPrivateStorage() {
  const parsed = z
    .object({
      SUPABASE_URL: z.url().startsWith("https://"),
      SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
      SUPABASE_STORAGE_BUCKET: z.literal("siteflow-documents"),
    })
    .safeParse(process.env);
  if (!parsed.success) throw new Error("Private storage is not configured");
  const env = parsed.data;
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return { client, bucket: env.SUPABASE_STORAGE_BUCKET };
}
export async function signPrivateDocument(path: string) {
  const { client, bucket } = getPrivateStorage();
  const info = await client.storage.getBucket(bucket);
  if (info.error || !info.data || info.data.public) throw new Error("Private storage unavailable");
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, 60, { download: true });
  if (error || !data) throw new Error("Document download unavailable");
  return data.signedUrl;
}
