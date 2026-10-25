import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Database } from "../db";
import { buildAuth, type Auth } from "./config";
import { consumeAttempt } from "./rate-limit";
import { readBoundedText, RequestBodyError } from "../request-body";

export function publicAuthPathAllowed(path: string, method: string) {
  return (
    (method === "POST" && ["/sign-in/username", "/sign-out"].includes(path)) ||
    (method === "GET" && path === "/get-session")
  );
}
export async function handleAuth(request: Request, auth: Auth, db: Database) {
  const path = new URL(request.url).pathname.replace(/^\/api\/auth/, "");
  if (!publicAuthPathAllowed(path, request.method))
    return Response.json(
      { error: "This authentication operation is not available" },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  if (
    request.method === "POST" &&
    (request.headers.get("origin") !== auth.options.baseURL ||
      request.headers.get("sec-fetch-site") === "cross-site")
  ) {
    return Response.json(
      { message: "Request origin rejected" },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  let text = "";
  if (request.method === "POST") {
    if (
      request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"
    )
      return Response.json(
        { message: "JSON is required" },
        { status: 415, headers: { "Cache-Control": "private, no-store" } },
      );
    try {
      text = await readBoundedText(request, 4096);
    } catch (error) {
      if (!(error instanceof RequestBodyError)) throw error;
      return Response.json(
        { message: error.message },
        { status: error.status, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    request = new Request(request, { body: text });
  }
  if (path === "/sign-in/username") {
    let username = "";
    try {
      username = String(JSON.parse(text).username ?? "")
        .trim()
        .toLowerCase()
        .slice(0, 100);
    } catch {
      return Response.json(
        { message: "Invalid username or password" },
        { status: 400, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    // Account-wide limiter complements Better Auth's persistent IP limiter.
    const key = `login-account:${createHash("sha256").update(username).digest("hex")}`;
    if (!(await consumeAttempt(db, key, 10, 300000)))
      return Response.json(
        { message: "Too many attempts. Try again in five minutes." },
        { status: 429, headers: { "Retry-After": "300", "Cache-Control": "private, no-store" } },
      );
  }
  const response =
    path === "/sign-in/username"
      ? await db.transaction(async (transaction) => {
          const tx = transaction as unknown as Database;
          // Credential verification and session creation serialize with status/role/
          // password changes; a concurrent reset cannot leave a newly usable old session.
          await tx.execute(sql`select pg_advisory_xact_lock(73190021)`);
          if (typeof auth.options.secret !== "string" || typeof auth.options.baseURL !== "string")
            throw new Error("Unsupported authentication configuration");
          return buildAuth(tx, {
            secret: auth.options.secret,
            url: auth.options.baseURL,
            rateLimit: auth.options.rateLimit?.enabled,
          }).handler(request);
        })
      : await auth.handler(request);
  response.headers.set("Cache-Control", "private, no-store");
  if (path === "/sign-in/username" && !response.ok && response.status !== 429) {
    return Response.json(
      {
        message:
          response.status === 403
            ? "Access is disabled or not allowed. Contact your administrator."
            : "Invalid username or password",
      },
      { status: response.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return response;
}
