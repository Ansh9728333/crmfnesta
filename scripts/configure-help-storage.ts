import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
async function main() {
  const { getPrivateStorage } = await import("../src/lib/documents/storage"),
    { helpBucket } = await import("../src/lib/help-tickets/storage");
  const { client } = getPrivateStorage(),
    info = await client.storage.getBucket(helpBucket);
  if (info.data?.public) throw new Error("Public bucket refused");
  const options = {
    public: false,
    fileSizeLimit: 10485760,
    allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
  };
  if (!info.data) {
    if (String(info.error?.statusCode) !== "404") throw new Error("Inspection failed");
    const r = await client.storage.createBucket(helpBucket, options);
    if (r.error) throw new Error("Creation failed");
  } else {
    const r = await client.storage.updateBucket(helpBucket, options);
    if (r.error) throw new Error("Configuration failed");
  }
  console.log(
    "Private help-ticket storage configured: 10 MiB, PDF/JPEG/PNG. Existing document bucket unchanged.",
  );
}
main()
  .then(() => process.exit(0))
  .catch(() => {
    console.error("Help storage configuration failed; provider details omitted.");
    process.exit(1);
  });
