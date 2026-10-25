"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { dateTime, localInput, selectClass, utcInput } from "@/features/leads/utils";
import { stageDefinition } from "@/lib/orders/definitions";
import { Labeled, StageFieldInput } from "./fields";
import type { OrderDetail, OrderStage, StageCommand } from "./types";
export function StageEditor({
  detail,
  stage,
  busy,
  run,
}: {
  detail: OrderDetail;
  stage: OrderStage;
  busy: boolean;
  run: StageCommand;
}) {
  const [owner, setOwner] = useState(stage.assignedTo ?? ""),
    [planned, setPlanned] = useState(localInput(stage.plannedAt)),
    [notes, setNotes] = useState(stage.notes),
    [data, setData] = useState(stage.data),
    [reviewNotes, setReviewNotes] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    def = stageDefinition(stage.number),
    isCurrent = stage.number === detail.order.stage && !detail.order.completedAt,
    glass = detail.order.companySlug === "s-grip",
    glassRequired = detail.stages.find((s) => s.number === 12)?.data.glassRequired === true;
  const employees = [
    ...new Map(
      detail.employees
        .filter(
          (p) =>
            ["Admin", "Super Admin"].includes(p.role) ||
            (p.role === stage.ownerRole &&
              p.permissions.includes("orders.read") &&
              p.permissions.includes(def.permission)),
        )
        .map((p) => [p.id, p]),
    ).values(),
  ];
  const fields = def.fields.filter(
    (f) => !f.glassOnly || (glass && (stage.number !== 13 || glassRequired)),
  );
  return (
    <section className="min-w-0 space-y-6 rounded-xl border bg-white p-5 sm:p-6 [overflow-wrap:anywhere]">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-primary">Stage {stage.number} of 16</p>
          <Badge variant="outline">{stage.status.replaceAll("_", " ")}</Badge>
        </div>
        <h2 className="mt-3 text-xl font-semibold">{stage.name}</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Owner responsibility: {stage.ownerRole} · Reviewer responsibility: {stage.approverRole}
        </p>
      </header>
      <dl className="grid gap-4 text-xs sm:grid-cols-2">
        {[
          ["Assigned employee", stage.assignedName ?? "Unassigned"],
          ["Target date", dateTime(stage.plannedAt)],
          ["Started date", dateTime(stage.startedAt)],
          ["Submitted date", dateTime(stage.submittedAt)],
          ["Completion date", dateTime(stage.completedAt)],
          ["Approved by", stage.approvedName ?? "Not approved"],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {detail.canManage && stage.status !== "completed" && stage.status !== "awaiting_approval" && (
        <form
          className="space-y-4 rounded-lg border bg-background p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run("plan", { assignedTo: owner, plannedAt: utcInput(planned) });
          }}
        >
          <h3 className="text-sm font-semibold">Assign responsibility & target</h3>
          <Labeled label="Stage owner">
            {(id) => (
              <select
                id={id}
                className={selectClass}
                value={owner}
                required
                onChange={(e) => setOwner(e.target.value)}
              >
                <option value="">Select eligible employee</option>
                {employees.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.role}
                  </option>
                ))}
              </select>
            )}
          </Labeled>
          <Labeled label="Planned completion (IST)">
            {(id) => (
              <Input
                id={id}
                type="datetime-local"
                value={planned}
                required
                onChange={(e) => setPlanned(e.target.value)}
              />
            )}
          </Labeled>
          {employees.length === 0 && (
            <p className="text-xs text-muted-foreground">
              An active employee needs the configured role, order read and stage module permission
              in this branch.
            </p>
          )}
          <Button size="sm" disabled={busy || !owner || !planned}>
            Save owner & target
          </Button>
        </form>
      )}
      {!isCurrent && stage.status !== "completed" && (
        <p className="rounded-lg bg-background p-4 text-sm text-muted-foreground">
          This stage opens after all preceding stages have been completed and approved.
          Responsibility and target dates can be planned in advance.
        </p>
      )}
      {isCurrent && stage.status === "pending" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Assign an owner and planned date, then start this stage. Required fields and documents
            are checked before submission.
          </p>
          {stage.canWrite && (
            <Button
              disabled={busy || !stage.assignedTo || !stage.plannedAt}
              onClick={() => void run("start")}
            >
              Start stage
            </Button>
          )}
        </div>
      )}
      {isCurrent &&
      ["in_progress", "changes_requested"].includes(stage.status) &&
      stage.canWrite ? (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void run("submit", { data, notes });
          }}
        >
          <div>
            <h3 className="font-semibold">Stage evidence</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              Fields marked * are required before submission. Actual evidence dates are recorded in
              IST.
            </p>
          </div>
          {stage.number === 1 && (
            <p className="rounded-lg bg-accent p-3 text-xs">
              Record a group that your team created. SiteFlow does not automatically create WhatsApp
              groups or send messages.
            </p>
          )}
          {stage.number === 9 && (
            <p className="rounded-lg bg-accent p-3 text-xs">
              Verify actual receipts against the approved contract terms. This records your
              verification; it does not query a bank or payment provider.
            </p>
          )}
          {stage.number === 16 && (
            <p className="rounded-lg bg-accent p-3 text-xs">
              Track the request and customer response. Testimonial and review URL requirements apply
              only when a review is received. A declined request, no response or any review
              sentiment can close this stage. A positive review is never required.
            </p>
          )}
          {fields.map((f) => (
            <StageFieldInput
              key={f.key}
              field={f}
              value={data[f.key]}
              required={
                stage.requiredFields.includes(f.key) &&
                !(
                  stage.number === 16 &&
                  ["testimonial", "reviewUrl"].includes(f.key) &&
                  data.reviewOutcome !== "received"
                )
              }
              onChange={(value) => setData((prev) => ({ ...prev, [f.key]: value }))}
            />
          ))}
          <Labeled label={`Stage notes${stage.requiredFields.includes("notes") ? " *" : ""}`}>
            {(id) => (
              <textarea
                id={id}
                className="min-h-28 w-full rounded-lg border p-3 text-sm"
                value={notes}
                maxLength={4000}
                onChange={(e) => setNotes(e.target.value)}
              />
            )}
          </Labeled>
          {stage.requiredFields.includes("attachments") && (
            <p className="text-xs text-muted-foreground">
              At least one stage attachment is required before submission. Upload evidence in the
              documents panel.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void run("save", { data, notes })}
            >
              Save evidence
            </Button>
            <Button disabled={busy}>Submit for approval</Button>
          </div>
        </form>
      ) : (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold">Recorded evidence</h3>
          {fields.map((f) => (
            <div key={f.key} className="min-w-0 text-xs">
              <p className="font-medium text-muted-foreground">{f.label}</p>
              {Array.isArray(stage.data[f.key]) ? (
                <ul className="mt-2 space-y-2">
                  {(stage.data[f.key] as { label: string; value: string; unit: string }[]).map(
                    (m, i) => (
                      <li key={i}>
                        {m.label}: {m.value} {m.unit}
                      </li>
                    ),
                  )}
                </ul>
              ) : (
                <p className="mt-2 whitespace-pre-wrap">
                  {typeof stage.data[f.key] === "boolean"
                    ? stage.data[f.key]
                      ? "Yes"
                      : "No"
                    : stage.data[f.key]
                      ? f.type === "datetime"
                        ? dateTime(String(stage.data[f.key]))
                        : String(stage.data[f.key])
                      : "Not recorded"}
                </p>
              )}
            </div>
          ))}
          <div className="text-xs">
            <p className="font-medium text-muted-foreground">Stage notes</p>
            <p className="mt-2 whitespace-pre-wrap">{stage.notes || "No notes recorded"}</p>
          </div>
        </section>
      )}
      {isCurrent && stage.status === "awaiting_approval" && (
        <section className="space-y-4 rounded-lg border bg-accent/40 p-4">
          <h3 className="font-semibold">Approval review</h3>
          <p className="text-xs text-muted-foreground">
            Evidence is locked while awaiting review. Review the recorded fields and attachments
            before approving.
          </p>
          {stage.canApprove ? (
            <>
              <Labeled label="Review notes / changes requested">
                {(id) => (
                  <textarea
                    id={id}
                    className="min-h-20 w-full rounded-lg border bg-white p-3 text-sm"
                    value={reviewNotes}
                    maxLength={2000}
                    onChange={(e) => setReviewNotes(e.target.value)}
                  />
                )}
              </Labeled>
              <label className="flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                I have reviewed the evidence and required documents for this stage.
              </label>
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={busy || !confirmed}
                  onClick={() => void run("approve", { reason: reviewNotes })}
                >
                  Approve stage
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || reviewNotes.trim().length < 3}
                  onClick={() => void run("reject", { reason: reviewNotes })}
                >
                  Request changes
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm">
              An authorized {stage.approverRole} or administrator must review this submission.
            </p>
          )}
        </section>
      )}
    </section>
  );
}
