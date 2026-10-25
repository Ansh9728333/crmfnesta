import { z } from "zod";
import { apiResponse } from "@/lib/http";
import { getDb } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { authorizedDocument } from "@/lib/documents/service";
import { signPrivateDocument } from "@/lib/documents/storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiResponse(async () =>
    authorizedDocument(
      getDb(),
      getAuth(),
      request.headers,
      z.uuid().parse((await params).id),
      signPrivateDocument,
    ),
  );
}
