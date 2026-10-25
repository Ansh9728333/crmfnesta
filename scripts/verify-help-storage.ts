// Authorized infrastructure probe, not a test-suite fixture or customer record.
import { config } from "dotenv";
import { randomUUID, createHash } from "node:crypto";
config({ path: ".env.local", quiet: true });
async function main() {
  const { getPrivateStorage } = await import("../src/lib/documents/storage"),
    { helpStorage, helpBucket } = await import("../src/lib/help-tickets/storage");
  const { client } = getPrivateStorage(),
    store = helpStorage(),
    path = `infrastructure-probe/${randomUUID()}`,
    largePath = `infrastructure-probe/${randomUUID()}`;
  const bytes = new Uint8Array(10485760);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  let passed = false;
  try {
    const signed = await store.prepare(path);
    const upload = await fetch(signed.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/png", "x-upsert": "false" },
      body: bytes,
    });
    if (!upload.ok) throw new Error("Signed upload failed");
    const overwrite = await fetch(signed.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/png", "x-upsert": "true" },
      body: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    });
    if (overwrite.ok) throw new Error("Immutable signed path overwritten");
    const downloaded = await store.read(path);
    if (
      createHash("sha256").update(downloaded).digest("hex") !==
      createHash("sha256").update(bytes).digest("hex")
    )
      throw new Error("Byte integrity failed");
    const download = await fetch(await store.sign(path));
    if (!download.ok || (await download.arrayBuffer()).byteLength !== bytes.length)
      throw new Error("Signed download failed");
    const anonymous = await fetch(
      `${process.env.SUPABASE_URL}/storage/v1/object/public/${helpBucket}/${path}`,
    );
    if (anonymous.ok) throw new Error("Anonymous download allowed");
    const over = await store.prepare(largePath),
      oversize = await fetch(over.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/png", "x-upsert": "false" },
        body: new Uint8Array(10485761),
      });
    if (oversize.ok) throw new Error("Oversized file accepted");
    passed = true;
  } finally {
    const cleanup = await client.storage.from(helpBucket).remove([path, largePath]);
    if (cleanup.error) throw new Error("Probe cleanup failed");
  }
  if (passed)
    console.log(
      "Help Storage passed: direct 10 MiB signed upload, overwrite denial, byte integrity, private signed download, anonymous denial, oversized upload rejection and probe cleanup. No customer records modified.",
    );
}
main()
  .then(() => process.exit(0))
  .catch(() => {
    console.error("Help Storage verification failed; provider details and signed URLs omitted.");
    process.exit(1);
  });
