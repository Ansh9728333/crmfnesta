import "server-only";
import { ZodError } from "zod";
import { APIError } from "better-auth/api";
import { AccessError } from "./auth/access";
import { getEnv } from "./env";
import { DuplicateLeadError } from "./leads/service";
import { readBoundedText, RequestBodyError } from "./request-body";

export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== getEnv().BETTER_AUTH_URL || request.headers.get("sec-fetch-site") === "cross-site")
    throw new AccessError(403, "Request origin rejected");
}
export async function jsonBody(request: Request) {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"
  )
    throw new AccessError(415, "JSON is required");
  const body = await readBoundedText(request, 32_768);
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new AccessError(400, "Invalid JSON");
  }
}
export async function apiResponse(work: () => Promise<unknown>) {
  try {
    getEnv();
    const result = await work();
    if (result instanceof Response) {
      result.headers.set("Cache-Control", "private, no-store");
      return result;
    }
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof DuplicateLeadError)
      return Response.json(
        {
          error: error.message,
          code: "POSSIBLE_DUPLICATE",
          candidates: error.candidates,
          restricted: error.restricted,
        },
        { status: 409, headers: { "Cache-Control": "private, no-store" } },
      );
    if (error instanceof AccessError || error instanceof RequestBodyError)
      return Response.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "private, no-store" } },
      );
    if (error instanceof ZodError)
      return Response.json(
        { error: "Check the form fields and try again", fields: error.flatten().fieldErrors },
        { status: 400, headers: { "Cache-Control": "private, no-store" } },
      );
    if (error instanceof APIError)
      return Response.json(
        {
          error:
            "The account operation could not be completed. Check the details or contact an administrator.",
        },
        { status: 400, headers: { "Cache-Control": "private, no-store" } },
      );
    // Deliberately omit database/provider messages, which can contain credentials or PII.
    return Response.json(
      { error: "Service unavailable. Contact your administrator." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
