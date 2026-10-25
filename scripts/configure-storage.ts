import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
async function main() {
  const { getPrivateStorage } = await import("../src/lib/documents/storage");
  const { client, bucket } = getPrivateStorage();
  const info = await client.storage.getBucket(bucket);
  if (info.data?.public)
    throw new Error(
      "Refusing an existing public bucket; make it private through an explicit review first",
    );
  if (!info.data) {
    if (String(info.error?.statusCode) !== "404")
      throw new Error("Storage bucket inspection failed");
    const result = await client.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: 4 * 1024 * 1024,
      allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
    });
    if (result.error) throw new Error("Private bucket creation failed");
  }
  console.log("Private storage bucket verified. No browser access policies were added.");
}
main()
  .then(() => process.exit(0))
  .catch(() => {
    console.error(
      "Private storage setup failed. Check the server configuration and bucket policy. No secrets were logged.",
    );
    process.exit(1);
  });
