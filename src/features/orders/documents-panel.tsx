"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dateTime, requestJson } from "@/features/leads/utils";
import type { OrderDetail, OrderStage } from "./types";
import { Labeled } from "./fields";
export function StageDocuments({
  detail,
  stage,
  busy,
  onUpload,
  onPage,
  onError,
}: {
  detail: OrderDetail;
  stage: OrderStage;
  busy: boolean;
  onUpload: (file: File, requirementId?: string) => Promise<void>;
  onPage: (page: number) => void;
  onError: (message: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [requirementId, setRequirementId] = useState(""),
    canUpload =
      stage.canWrite &&
      stage.number === detail.order.stage &&
      ["pending", "in_progress", "changes_requested"].includes(stage.status);
  return (
    <section className="min-w-0 space-y-4 rounded-xl border bg-white p-5 [overflow-wrap:anywhere]">
      <h2 className="font-semibold">Stage documents</h2>
      {detail.requirements
        .filter((r) => Number(r.config.stageNumber) === stage.number)
        .map((r) => (
          <p key={r.id} className="text-xs">
            Required company document: {r.name}
          </p>
        ))}
      <p className="text-xs text-muted-foreground">
        Private PDF, JPEG and PNG · maximum 4 MiB per file. Download links expire after 60 seconds.
      </p>
      {detail.files.map((f) => (
        <article
          key={f.id}
          className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3"
        >
          <div className="min-w-0">
            <p className="break-all text-sm font-medium">{f.name}</p>
            {f.requirementId && (
              <p className="mt-1 text-xs">
                Requirement:{" "}
                {stage.documentRequirements.find((r) => r.id === f.requirementId)?.name ??
                  "Recorded requirement"}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {dateTime(f.createdAt)} · {Math.ceil(f.byteSize / 1024)} KB
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              try {
                const result = await requestJson<{ url: string }>(
                  `/api/orders/${detail.order.id}/documents/${f.id}`,
                );
                window.location.assign(result.url);
              } catch (error) {
                onError((error as Error).message);
              }
            }}
          >
            Download
          </Button>
        </article>
      ))}
      {!detail.files.length && (
        <p className="py-4 text-sm text-muted-foreground">No documents uploaded for this stage.</p>
      )}
      {canUpload && (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!file) return;
            const form = e.currentTarget;
            try {
              await onUpload(file, requirementId || undefined);
              setFile(null);
              form.reset();
            } catch {
              /* The workspace retains the provider error and the selected file for retry. */
            }
          }}
        >
          <Labeled label="Upload stage document">
            {(id) => (
              <Input
                id={id}
                type="file"
                required
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            )}
          </Labeled>
          {!!detail.requirements.filter((r) => Number(r.config.stageNumber) === stage.number)
            .length && (
            <Labeled label="Document requirement">
              {(id) => (
                <select
                  id={id}
                  className="h-10 w-full rounded-md border bg-white px-3 text-xs"
                  value={requirementId}
                  onChange={(e) => setRequirementId(e.target.value)}
                >
                  <option value="">General stage attachment</option>
                  {detail.requirements
                    .filter((r) => Number(r.config.stageNumber) === stage.number)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
              )}
            </Labeled>
          )}
          <Button disabled={busy || !file} size="sm">
            Upload privately
          </Button>
        </form>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={busy || detail.filePage <= 1}
          onClick={() => onPage(detail.filePage - 1)}
        >
          Newer files
        </Button>
        <span className="text-xs text-muted-foreground">
          {detail.fileTotal} files · Page {detail.filePage}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy || detail.filePage * 20 >= detail.fileTotal}
          onClick={() => onPage(detail.filePage + 1)}
        >
          Older files
        </Button>
      </div>
    </section>
  );
}
