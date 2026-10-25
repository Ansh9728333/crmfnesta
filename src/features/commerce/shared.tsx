"use client";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Labeled } from "@/features/orders/fields";
import { requestJson } from "@/features/leads/utils";
import type { CommerceDetail } from "./types";
export type Command = (body: unknown) => Promise<void>;
export type FileRenderer = (
  kind: "payment" | "dispatch" | "delivery",
  target: string,
  canUpload: boolean,
) => ReactNode;
export const get = (f: FormData, n: string) => String(f.get(n) ?? "");
export function Field({
  label,
  name,
  type = "text",
  defaultValue = "",
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <Labeled label={label}>
      {(id) => (
        <Input
          id={id}
          name={name}
          type={type}
          defaultValue={defaultValue}
          required={required}
          maxLength={type === "text" ? 2000 : undefined}
          min={type === "number" ? "0" : undefined}
          step={type === "number" ? "0.01" : undefined}
        />
      )}
    </Labeled>
  );
}
export function Form({
  title,
  children,
  submit,
  busy,
  onSubmit,
}: {
  title: string;
  children: ReactNode;
  submit: string;
  busy: boolean;
  onSubmit: (f: FormData) => Promise<void>;
}) {
  return (
    <form
      className="space-y-4 rounded-xl border bg-white p-5"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit(new FormData(e.currentTarget));
      }}
    >
      <h2 className="font-semibold">{title}</h2>
      {children}
      <Button disabled={busy}>{busy ? "Saving…" : submit}</Button>
    </form>
  );
}
export function Files({
  d,
  kind,
  target,
  busy,
  canUpload,
  onUpload,
  onError,
}: {
  d: CommerceDetail;
  kind: "payment" | "dispatch" | "delivery";
  target: string;
  busy: boolean;
  canUpload: boolean;
  onUpload: (file: File) => Promise<void>;
  onError: (s: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    label =
      kind === "payment"
        ? "Receipt"
        : kind === "dispatch"
          ? "Delivery challan"
          : "Proof of delivery";
  return (
    <div className="space-y-3 rounded-lg bg-muted/40 p-3">
      <p className="text-xs font-semibold">{label}</p>
      {d.files
        .filter((f) => f[`${kind}Id`] === target)
        .map((f) => (
          <button
            type="button"
            key={f.id}
            className="block max-w-full break-all text-left text-xs underline"
            onClick={() => {
              void requestJson<{ url: string }>(`/api/commerce/orders/${d.order.id}/files/${f.id}`)
                .then((r) => window.open(r.url, "_blank", "noopener,noreferrer"))
                .catch((e) => onError(e.message));
            }}
          >
            {f.name}
          </button>
        ))}
      {canUpload && (
        <>
          <Input
            aria-label={`${label} file ${target}`}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button
            size="sm"
            variant="outline"
            type="button"
            disabled={busy || !file}
            onClick={() => {
              if (file) void onUpload(file);
            }}
          >
            Upload {label.toLowerCase()}
          </Button>
          <p className="text-xs text-muted-foreground">Private PDF, JPEG or PNG · up to 4 MiB</p>
        </>
      )}
    </div>
  );
}
