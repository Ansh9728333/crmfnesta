import { getAuth } from "@/lib/auth";
import { handleAuth, publicAuthPathAllowed } from "@/lib/auth/handler";
import { getDb } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  const path = new URL(request.url).pathname.replace(/^\/api\/auth/, "");
  if (!publicAuthPathAllowed(path, request.method))
    return Response.json(
      { error: "This authentication operation is not available" },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  try {
    return await handleAuth(request, getAuth(), getDb());
  } catch {
    return Response.json(
      { message: "Sign-in service unavailable. Contact your administrator." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
export const GET = handle;
export const POST = handle;
