"use client";
import { useState, type ReactNode } from "react";
import { Labeled } from "@/features/orders/fields";
import { selectClass, requestJson } from "@/features/leads/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Detail } from "./types";
export { Field, Form, get } from "@/features/commerce/shared";
export type Run = (body: unknown) => Promise<void>;
export type Files = (kind: string, id: string, enabled: boolean) => ReactNode;
export function Select({
  label,
  name,
  values,
  defaultValue,
  multiple = false,
}: {
  label: string;
  name: string;
  values: { id: string; name: string }[];
  defaultValue?: string | string[];
  multiple?: boolean;
}) {
  return (
    <Labeled label={label}>
      {(id) => (
        <select
          id={id}
          name={name}
          className={multiple ? `${selectClass} h-28` : selectClass}
          required
          multiple={multiple}
          defaultValue={defaultValue ?? (multiple ? [] : "")}
        >
          <option value="" disabled>
            Choose…
          </option>
          {[...new Map(values.map((v) => [v.id, v])).values()].map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      )}
    </Labeled>
  );
}
export function Evidence({
  d,
  kind,
  target,
  enabled,
  busy,
  refresh,
  error,
}: {
  d: Detail;
  kind: string;
  target: string;
  enabled: boolean;
  busy: boolean;
  refresh: (work: () => Promise<void>) => Promise<void>;
  error: (message: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    matches = d.files.filter(
      (f) =>
        f.kind === kind && [f.installationId, f.auditId, f.handoverId, f.ticketId].includes(target),
    );
  return (
    <div className="space-y-2 rounded-lg bg-muted/40 p-3">
      <h3 className="text-xs font-semibold capitalize">{kind.replaceAll("_", " ")}</h3>
      {matches.map((f) => (
        <button
          type="button"
          key={f.id}
          className="block break-all text-left text-xs underline"
          onClick={async () => {
            try {
              const r = await requestJson<{ url: string }>(
                `/api/aftercare/orders/${d.order.id}/files/${f.id}`,
              );
              window.open(r.url, "_blank", "noopener,noreferrer");
            } catch (e) {
              error((e as Error).message);
            }
          }}
        >
          {f.name}
        </button>
      ))}
      {!matches.length && <p className="text-xs text-muted-foreground">No evidence uploaded.</p>}
      {enabled && (
        <>
          <Input
            aria-label={`Upload ${kind.replaceAll("_", " ")}`}
            type="file"
            accept={
              kind.endsWith("_photo")
                ? "image/jpeg,image/png"
                : "application/pdf,image/jpeg,image/png"
            }
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!file || busy}
            onClick={() =>
              void refresh(async () => {
                if (!file) return;
                const form = new FormData();
                form.set("file", file);
                const response = await fetch(
                  `/api/aftercare/orders/${d.order.id}/files?kind=${kind}&target=${target}`,
                  { method: "POST", body: form },
                );
                if (!response.ok) throw new Error((await response.json()).error ?? "Upload failed");
              })
            }
          >
            Upload evidence
          </Button>
        </>
      )}
    </div>
  );
}
