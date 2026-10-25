"use client";
import { auditChecks } from "@/lib/aftercare/validation";
import { utcInput, dateTime, localInput } from "@/features/leads/utils";
import { Field, Form, get, Select, type Files, type Run } from "./shared";
import type { Detail } from "./types";
export function Audit({
  d,
  i,
  busy,
  run,
  files,
}: {
  d: Detail;
  i: Detail["installations"][number];
  busy: boolean;
  run: Run;
  files: Files;
}) {
  const audit = d.audits.find((a) => a.installationId === i.id),
    load = d.loads.find((l) => l.id === i.loadId),
    work =
      d.permissions.audit && (d.permissions.coordinate || audit?.engineerId === d.currentUserId),
    engineers = d.employees.filter((e) => e.permissions.includes("audits.manage")),
    installers = d.employees.filter((e) => e.permissions.includes("installations.manage"));
  return (
    <section className="space-y-4 rounded-xl border bg-white p-5">
      <h2 className="text-lg font-semibold">Load {load?.loadNumber} · Service engineer audit</h2>
      {audit && (
        <p className="text-xs text-muted-foreground">
          Engineer:{" "}
          {d.employees.find((e) => e.id === audit.engineerId)?.name ?? "Recorded employee"} ·
          Approved by: {d.employees.find((e) => e.id === audit.approvedBy)?.name ?? "Pending"}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {audit?.status.replaceAll("_", " ") ?? "Not scheduled"} · Inspection{" "}
        {dateTime(audit?.inspectionAt)} · Approval {dateTime(audit?.completedAt)}
      </p>
      {d.permissions.coordinate &&
        (!audit || ["planned", "changes_required"].includes(audit.status)) && (
          <Form
            title="Schedule engineer audit"
            submit="Save audit assignment"
            busy={busy}
            onSubmit={(f) =>
              run({
                action: "audit.plan",
                installationId: i.id,
                version: audit?.version ?? 0,
                engineerId: get(f, "engineerId"),
                plannedAt: utcInput(get(f, "plannedAt")),
                notes: get(f, "notes"),
              })
            }
          >
            <Select
              label="Assigned service engineer"
              name="engineerId"
              values={engineers}
              defaultValue={audit?.engineerId}
            />
            <Field
              label="Planned inspection (IST)"
              name="plannedAt"
              type="datetime-local"
              defaultValue={localInput(audit?.plannedAt)}
            />
            <Field label="Audit planning notes" name="notes" />
          </Form>
        )}
      {audit && work && !["submitted", "approved"].includes(audit.status) && (
        <Form
          title="Site quality inspection"
          submit="Save inspection findings"
          busy={busy}
          onSubmit={(f) =>
            run({
              action: "audit.inspect",
              id: audit.id,
              version: audit.version,
              inspectionAt: utcInput(get(f, "inspectionAt")),
              checklist: auditChecks.map((key) => ({
                key,
                result: get(f, key),
                notes: get(f, `${key}_notes`),
              })),
              notes: get(f, "notes"),
            })
          }
        >
          <Field
            label="Inspection date (IST)"
            name="inspectionAt"
            type="datetime-local"
            defaultValue={localInput(audit.inspectionAt)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {auditChecks.map((key) => {
              const old = audit.checklist.find((c) => c.key === key);
              return (
                <div className="space-y-2 rounded-lg bg-muted/30 p-3" key={key}>
                  <Select
                    label={key[0].toUpperCase() + key.slice(1)}
                    name={key}
                    values={[
                      { id: "pass", name: "Pass" },
                      { id: "fail", name: "Fail" },
                      { id: "not_applicable", name: "Not Applicable (reason required)" },
                    ]}
                    defaultValue={old?.result}
                  />
                  <Field
                    label={`${key} findings / Not Applicable reason`}
                    name={`${key}_notes`}
                    required={false}
                    defaultValue={old?.notes}
                  />
                </div>
              );
            })}
          </div>
          <Field label="Quality findings" name="notes" defaultValue={audit.notes ?? ""} />
        </Form>
      )}
      {audit && (
        <>
          {files(
            "audit_photo",
            audit.id,
            !!work && !["approved", "submitted"].includes(audit.status),
          )}
          <ul className="space-y-2">
            {audit.checklist.map((c) => (
              <li className="rounded-lg bg-muted/30 p-3 text-sm" key={c.key}>
                {c.key}: {c.result.replaceAll("_", " ")} {c.notes && `· ${c.notes}`}
              </li>
            ))}
          </ul>
          <h3 className="font-semibold">Corrective action / punch list</h3>
          {d.punches
            .filter((p) => p.auditId === audit.id)
            .map((p) => (
              <div key={p.id} className="space-y-3 rounded-lg border p-3">
                <p className="text-sm">
                  {p.description} · {p.status} · Due {dateTime(p.dueAt)}
                </p>
                {p.resolution && <p className="text-sm">Resolution: {p.resolution}</p>}
                {p.status === "open" &&
                  (work || (d.permissions.install && p.assignedTo === d.currentUserId)) && (
                    <Form
                      title="Resolve punch item"
                      submit="Record corrective action"
                      busy={busy}
                      onSubmit={(f) =>
                        run({
                          action: "punch.resolve",
                          id: p.id,
                          version: p.version,
                          occurredAt: utcInput(get(f, "occurredAt")),
                          notes: get(f, "notes"),
                        })
                      }
                    >
                      <Field
                        label="Correction date (IST)"
                        name="occurredAt"
                        type="datetime-local"
                      />
                      <Field label="Corrective action taken" name="notes" />
                    </Form>
                  )}
              </div>
            ))}
          {work && !["approved", "submitted"].includes(audit.status) && (
            <Form
              title="Add corrective action"
              submit="Add punch item"
              busy={busy}
              onSubmit={(f) =>
                run({
                  action: "punch.create",
                  auditId: audit.id,
                  description: get(f, "description"),
                  assignedTo: get(f, "assignedTo"),
                  dueAt: utcInput(get(f, "dueAt")),
                  notes: get(f, "notes"),
                })
              }
            >
              <Field label="Punch item / quality issue" name="description" />
              <Select label="Responsible installer" name="assignedTo" values={installers} />
              <Field label="Correction due (IST)" name="dueAt" type="datetime-local" />
              <Field label="Corrective action notes" name="notes" />
            </Form>
          )}
          {work && audit.status !== "approved" && (
            <Form
              title={
                audit.status === "submitted" ? "Review final audit" : "Submit audit for approval"
              }
              submit={audit.status === "submitted" ? "Record audit decision" : "Submit audit"}
              busy={busy}
              onSubmit={(f) =>
                run({
                  action: audit.status === "submitted" ? get(f, "decision") : "audit.submit",
                  id: audit.id,
                  version: audit.version,
                  notes: get(f, "notes"),
                })
              }
            >
              {audit.status === "submitted" && (
                <Select
                  label="Final audit decision"
                  name="decision"
                  values={[
                    { id: "audit.approve", name: "Final approval" },
                    { id: "audit.changes", name: "Require corrective changes" },
                  ]}
                />
              )}
              <Field label="Decision / submission notes" name="notes" />
              <p className="text-xs text-muted-foreground">
                Every required check must pass and all punch items must be resolved.
              </p>
            </Form>
          )}
        </>
      )}
      {load?.status === "audit_passed" && d.permissions.closeLoad && (
        <Form
          title="Complete this production load"
          submit="Mark load complete"
          busy={busy}
          onSubmit={(f) =>
            run({
              action: "load.complete",
              loadId: load.id,
              version: load.version,
              occurredAt: utcInput(get(f, "occurredAt")),
              notes: get(f, "notes"),
            })
          }
        >
          <Field label="Load completed date (IST)" name="occurredAt" type="datetime-local" />
          <Field label="Load completion notes" name="notes" />
          <p className="text-xs text-muted-foreground">
            Completing one load does not complete the order.
          </p>
        </Form>
      )}
    </section>
  );
}
