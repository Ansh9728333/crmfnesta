"use client";
import { useState } from "react";
import Decimal from "decimal.js";
import { dateTime, localInput, utcInput } from "@/features/leads/utils";
import { Button } from "@/components/ui/button";
import { Field, Form, get, Select, type Run, type Files } from "./shared";
import type { Detail } from "./types";
export function Installation({
  d,
  load,
  busy,
  run,
  files,
}: {
  d: Detail;
  load: Detail["loads"][number];
  busy: boolean;
  run: Run;
  files: Files;
}) {
  const i = d.installations.find((i) => i.loadId === load.id),
    g = d.glass.find((g) => g.installationId === i?.id),
    items = d.items.filter((i) => i.loadId === load.id),
    [nonce] = useState(() => crypto.randomUUID()),
    [dimensionCount, setDimensionCount] = useState(Math.max(1, g?.dimensions.length ?? 0));
  const work =
      d.permissions.install &&
      (!i ||
        d.permissions.coordinate ||
        i.assignedTo === d.currentUserId ||
        i.teamMembers.includes(d.currentUserId)),
    team = d.employees.filter((e) => e.permissions.includes("installations.manage")),
    sg = d.order.companySlug === "s-grip";
  const at = (f: FormData) => utcInput(get(f, "occurredAt"));
  return (
    <article className="space-y-4 rounded-xl border bg-white p-5">
      <header className="flex flex-wrap justify-between gap-2">
        <h2 className="text-lg font-semibold">Load {load.loadNumber} · Installation</h2>
        <span className="rounded-full bg-muted px-3 py-1 text-xs">
          {i?.status.replaceAll("_", " ") ?? "Not scheduled"}
        </span>
      </header>
      <p className="text-xs text-muted-foreground">
        {i?.teamName ?? "No team assigned"} · Planned {dateTime(i?.plannedAt)} · Started{" "}
        {dateTime(i?.startedAt)} · Completed {dateTime(i?.completedAt)}
      </p>
      {i && (
        <p className="text-xs text-muted-foreground">
          Team:{" "}
          {[i.assignedTo, ...i.teamMembers]
            .filter((id, n, all) => id && all.indexOf(id) === n)
            .map((id) => d.employees.find((e) => e.id === id)?.name ?? "Recorded employee")
            .join(", ")}
        </p>
      )}
      {items.map((item) => {
        const pct = new Decimal(item.installedQuantity).div(item.quantity).times(100).toNumber();
        return (
          <div key={item.id}>
            <div className="flex justify-between gap-3 text-sm">
              <span>{item.name}</span>
              <span>
                {item.installedQuantity} / {item.quantity}
              </span>
            </div>
            <progress
              aria-label={`${item.name} installed`}
              className="mt-2 h-2 w-full accent-primary"
              max={100}
              value={pct}
            />
            <p className="text-xs text-muted-foreground">
              Pending: {new Decimal(item.quantity).minus(item.installedQuantity).toString()}
            </p>
          </div>
        );
      })}
      {d.permissions.coordinate && i?.status !== "completed" && (
        <Form
          title={i ? "Update installation team" : "Schedule installation"}
          submit="Save installation plan"
          busy={busy}
          onSubmit={(f) =>
            run({
              action: "installation.plan",
              loadId: load.id,
              version: i?.version ?? 0,
              assignedTo: get(f, "assignedTo"),
              teamName: get(f, "teamName"),
              teamMembers: f.getAll("teamMembers"),
              plannedAt: utcInput(get(f, "plannedAt")),
              remarks: get(f, "notes"),
            })
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Installation team name" name="teamName" defaultValue={i?.teamName} />
            <Select
              label="Team leader"
              name="assignedTo"
              values={team}
              defaultValue={i?.assignedTo ?? ""}
            />
            <Select
              label="Team members (select multiple)"
              name="teamMembers"
              multiple
              values={team}
              defaultValue={i?.teamMembers}
            />
            <Field
              label="Planned start (IST)"
              name="plannedAt"
              type="datetime-local"
              defaultValue={localInput(i?.plannedAt)}
            />
            <Field label="Planning remarks" name="notes" defaultValue={i?.remarks} />
          </div>
        </Form>
      )}
      {i?.status === "planned" && work && (
        <Form
          title="Start installation"
          submit="Record actual start"
          busy={busy}
          onSubmit={(f) =>
            run({
              action: "installation.start",
              id: i.id,
              version: i.version,
              occurredAt: at(f),
              ...(sg ? { glassRequired: get(f, "glassRequired") === "yes" } : {}),
              notes: get(f, "notes"),
            })
          }
        >
          <Field label="Actual start (IST)" name="occurredAt" type="datetime-local" />
          {sg && (
            <Select
              label="Glass Required"
              name="glassRequired"
              values={[
                { id: "yes", name: "YES" },
                { id: "no", name: "NO" },
              ]}
            />
          )}
          <Field label="Start remarks" name="notes" />
          <p className="text-xs text-muted-foreground">Confirmed full delivery is required.</p>
        </Form>
      )}
      {i?.status === "in_progress" && work && (
        <Form
          title="Record installed quantities"
          submit="Save installed quantity"
          busy={busy}
          onSubmit={(f) =>
            run({
              action: "installation.progress",
              id: i.id,
              version: i.version,
              loadItemId: get(f, "loadItemId"),
              quantity: get(f, "quantity"),
              requestId: nonce,
              occurredAt: at(f),
              notes: get(f, "notes"),
            })
          }
        >
          <Select
            label="Load item"
            name="loadItemId"
            values={items.map((x) => ({ id: x.id, name: x.name ?? "Order item" }))}
          />
          <Field label="Quantity installed in this update" name="quantity" />
          <Field label="Work date (IST)" name="occurredAt" type="datetime-local" />
          <Field label="Installation remarks" name="notes" />
        </Form>
      )}
      {sg && g && (
        <section className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <h3 className="font-semibold">
            S-Grip glass checklist · {g.glassRequired ? "YES" : "NO"}
          </h3>
          {!g.glassRequired ? (
            <p className="text-sm">Glass not required. Checklist skipped.</p>
          ) : (
            <>
              <ol className="space-y-1 text-sm">
                <li>
                  Measurement: {g.measurementTaken ? dateTime(g.measuredAt) : "Pending"} ·{" "}
                  {d.employees.find((e) => e.id === g.responsibleId)?.name ?? "Unassigned"}
                </li>
                <li>
                  Template prepared: {g.templatePrepared ? dateTime(g.preparedAt) : "Pending"}
                  {" · "}
                  {d.employees.find((e) => e.id === g.preparedBy)?.name ?? "Pending"}
                </li>
                <li>
                  Template approved: {g.templateApproved ? dateTime(g.approvedAt) : "Pending"}
                  {" · "}
                  {d.employees.find((e) => e.id === g.approvedBy)?.name ?? "Pending"}
                </li>
              </ol>
              {g.dimensions.map((x, n) => (
                <p key={n} className="text-sm">
                  {x.label}: {x.value} {x.unit}
                </p>
              ))}
              {work && !g.templatePrepared && (
                <Form
                  title="Glass measurement"
                  submit="Record glass dimensions"
                  busy={busy}
                  onSubmit={(f) =>
                    run({
                      action: "glass.measure",
                      installationId: i!.id,
                      version: g.version,
                      responsibleId: get(f, "responsibleId"),
                      occurredAt: at(f),
                      dimensions: Array.from({ length: dimensionCount }, (_, n) => ({
                        label: get(f, `dimension${n}`),
                        value: get(f, `value${n}`),
                        unit: get(f, `unit${n}`),
                      })),
                      notes: get(f, "notes"),
                    })
                  }
                >
                  {Array.from({ length: dimensionCount }, (_, n) => (
                    <div key={n} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
                      <Field
                        label={n === 0 ? "Dimension description" : `Dimension ${n + 1} description`}
                        name={`dimension${n}`}
                        defaultValue={g.dimensions[n]?.label}
                      />
                      <Field
                        label={n === 0 ? "Dimension value" : `Dimension ${n + 1} value`}
                        name={`value${n}`}
                        defaultValue={g.dimensions[n]?.value}
                      />
                      <Select
                        label={n === 0 ? "Unit" : `Dimension ${n + 1} unit`}
                        name={`unit${n}`}
                        values={["mm", "cm", "m", "ft", "in"].map((v) => ({ id: v, name: v }))}
                        defaultValue={g.dimensions[n]?.unit}
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={dimensionCount >= 50}
                    onClick={() => setDimensionCount((n) => n + 1)}
                  >
                    Add dimension
                  </Button>
                  <Select label="Responsible employee" name="responsibleId" values={team} />
                  <Field label="Measurement date (IST)" name="occurredAt" type="datetime-local" />
                  <Field label="Measurement notes" name="notes" />
                </Form>
              )}
              {files("glass_template", i!.id, !!work && !g.templateApproved)}
              {work && g.measurementTaken && !g.templatePrepared && (
                <Form
                  title="Prepare glass template"
                  submit="Record prepared template"
                  busy={busy}
                  onSubmit={(f) =>
                    run({
                      action: "glass.prepare",
                      installationId: i!.id,
                      version: g.version,
                      templateFileId: get(f, "templateFileId"),
                      occurredAt: at(f),
                      notes: get(f, "notes"),
                    })
                  }
                >
                  <Select
                    label="Uploaded glass template"
                    name="templateFileId"
                    values={d.files
                      .filter((x) => x.installationId === i!.id && x.kind === "glass_template")
                      .map((x) => ({ id: x.id, name: x.name ?? "Order item" }))}
                  />
                  <Field label="Prepared date (IST)" name="occurredAt" type="datetime-local" />
                  <Field label="Preparation notes" name="notes" />
                </Form>
              )}
              {d.permissions.audit && g.templatePrepared && !g.templateApproved && (
                <Form
                  title="Approve glass template"
                  submit="Approve template"
                  busy={busy}
                  onSubmit={(f) =>
                    run({
                      action: "glass.approve",
                      installationId: i!.id,
                      version: g.version,
                      occurredAt: at(f),
                      notes: get(f, "notes"),
                    })
                  }
                >
                  <Field label="Approval date (IST)" name="occurredAt" type="datetime-local" />
                  <Field label="Approval notes" name="notes" />
                </Form>
              )}
            </>
          )}
        </section>
      )}
      {i && files("installation_photo", i.id, !!work && i.status === "in_progress")}
      {i?.status === "in_progress" && work && (
        <Form
          title="Complete installation"
          submit="Confirm installation complete"
          busy={busy}
          onSubmit={(f) =>
            run({
              action: "installation.complete",
              id: i.id,
              version: i.version,
              occurredAt: at(f),
              notes: get(f, "notes"),
            })
          }
        >
          <Field label="Completed date (IST)" name="occurredAt" type="datetime-local" />
          <Field label="Completion remarks" name="notes" />
          <p className="text-xs text-muted-foreground">
            All load quantities, photos and required glass approval must be complete.
          </p>
        </Form>
      )}
      {i?.remarks && <p className="text-sm">{i.remarks}</p>}
      {!items.length && (
        <p className="text-sm">Allocate load items before scheduling installation.</p>
      )}
      <Button asChild variant="link">
        <a href={`/production/${load.id}`}>Open production load</a>
      </Button>
    </article>
  );
}
