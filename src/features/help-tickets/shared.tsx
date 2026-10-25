"use client";
import type { ReactNode } from "react";
import { requestJson } from "@/features/leads/utils";
export const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-2 text-xs font-medium">
      {label}
      {children}
    </label>
  );
}
export const textareaClass = "min-h-28 w-full rounded-md border bg-background p-3 text-sm";
export async function uploadHelpFile(
  file: File,
  destination: { source?: { kind: "lead" | "project"; id: string }; ticketId?: string },
) {
  if (
    !["image/png", "image/jpeg", "application/pdf"].includes(file.type) ||
    file.size > 10485760 ||
    !file.size
  )
    throw new Error("Choose one PDF, JPEG or PNG up to 10 MB.");
  const lease = await requestJson<{ id: string; signedUrl: string }>(
    "/api/help-tickets/files",
    "POST",
    { name: file.name, size: file.size, contentType: file.type, ...destination },
  );
  const response = await fetch(lease.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type, "x-upsert": "false" },
    body: file,
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) throw new Error("Private upload failed. Retry before submitting the ticket.");
  await requestJson("/api/help-tickets/files", "PATCH", { id: lease.id });
  return lease.id;
}
