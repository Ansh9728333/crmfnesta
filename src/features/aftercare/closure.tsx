"use client";
import { handoverDocumentKinds } from "@/lib/aftercare/validation";
import { utcInput, localInput, dateTime } from "@/features/leads/utils";
import { Field, Form, get, Select, type Run, type Files } from "./shared";
import type { Detail } from "./types";
export function Closure({
  d,
  run,
  busy,
  files,
}: {
  d: Detail;
  run: Run;
  busy: boolean;
  files: Files;
}) {
  const h = d.handover,
    f = d.feedback,
    engineers = d.employees.filter((e) => e.permissions.includes("service.manage"));
  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold">Site handover & customer acceptance</h2>
        <p className="text-sm text-muted-foreground">
          All loads, installed quantities, audits, required glass approvals and mandatory documents
          must be complete. Approve workflow stages 1–14 before confirming.
        </p>
        {!h && d.permissions.coordinate && (
          <Form
            title="Prepare handover documents"
            submit="Create handover record"
            busy={busy}
            onSubmit={(v) => run({ action: "handover.prepare", notes: get(v, "notes") })}
          >
            <Field label="Handover preparation notes" name="notes" />
          </Form>
        )}
        {h && (
          <>
            {handoverDocumentKinds.map((k) => (
              <div key={k}>{files(k, h.id, d.permissions.coordinate && h.status === "draft")}</div>
            ))}
            {h.status === "confirmed" ? (
              <div className="rounded-lg bg-primary/5 p-4 text-sm">
                <p>Customer acceptance recorded: {h.customerRepresentative}</p>
                <p>Handover: {dateTime(h.completedAt)}</p>
                <p>Acceptance reference: {h.acceptanceReference}</p>
              </div>
            ) : (
              d.permissions.coordinate && (
                <Form
                  title="Confirm final handover"
                  submit="Confirm customer handover"
                  busy={busy}
                  onSubmit={(v) =>
                    run({
                      action: "handover.confirm",
                      id: h.id,
                      version: h.version,
                      occurredAt: utcInput(get(v, "occurredAt")),
                      customerAccepted: get(v, "accepted") === "yes",
                      customerRepresentative: get(v, "representative"),
                      acceptanceReference: get(v, "reference"),
                      notes: get(v, "notes"),
                    })
                  }
                >
                  <Field label="Handover date (IST)" name="occurredAt" type="datetime-local" />
                  <Field label="Customer representative" name="representative" />
                  <Field label="Signed acceptance reference" name="reference" />
                  <label className="flex items-center gap-2 text-sm">
                    <input name="accepted" type="checkbox" value="yes" required />
                    Customer has accepted the site handover
                  </label>
                  <Field label="Handover remarks" name="notes" />
                </Form>
              )
            )}
          </>
        )}
      </section>
      {h?.status === "confirmed" && (
        <>
          <section className="space-y-4 rounded-xl border bg-white p-5">
            <h2 className="text-lg font-semibold">Customer feedback</h2>
            <p className="text-sm text-muted-foreground">
              Record requests made through your actual communication channels. A positive review,
              public testimonial or Google review is never required.
            </p>
            {f && (
              <p className="text-sm">
                Feedback status: {f.status} · Rating: {f.rating ?? "Not provided"} · {f.comments}
              </p>
            )}
            {d.permissions.coordinate && (
              <Form
                title="Record requests and feedback"
                submit="Save customer feedback"
                busy={busy}
                onSubmit={(v) =>
                  run({
                    action: "feedback.save",
                    version: f?.version ?? 0,
                    ...(get(v, "google") ? { googleRequestedAt: utcInput(get(v, "google")) } : {}),
                    ...(get(v, "testimonialAt")
                      ? { testimonialRequestedAt: utcInput(get(v, "testimonialAt")) }
                      : {}),
                    status: get(v, "status"),
                    ...(get(v, "received") ? { receivedAt: utcInput(get(v, "received")) } : {}),
                    comments: get(v, "notes"),
                    testimonial: get(v, "testimonial"),
                    reviewUrl: get(v, "reviewUrl"),
                    ...(get(v, "rating") ? { rating: Number(get(v, "rating")) } : {}),
                    publicationConsent: get(v, "consent") === "yes",
                  })
                }
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Google review requested (IST)"
                    name="google"
                    type="datetime-local"
                    required={false}
                    defaultValue={localInput(f?.googleRequestedAt)}
                  />
                  <Field
                    label="Testimonial requested (IST)"
                    name="testimonialAt"
                    type="datetime-local"
                    required={false}
                    defaultValue={localInput(f?.testimonialRequestedAt)}
                  />
                  <Select
                    label="Feedback status"
                    name="status"
                    values={["pending", "requested", "received", "declined", "no_response"].map(
                      (x) => ({ id: x, name: x.replaceAll("_", " ") }),
                    )}
                    defaultValue={f?.status}
                  />
                  <Field
                    label="Feedback received (IST)"
                    name="received"
                    type="datetime-local"
                    required={false}
                    defaultValue={localInput(f?.receivedAt)}
                  />
                  <Field
                    label="Rating (optional, 1–5)"
                    name="rating"
                    required={false}
                    defaultValue={String(f?.rating ?? "")}
                  />
                  <Field
                    label="Google review URL (optional)"
                    name="reviewUrl"
                    type="url"
                    required={false}
                    defaultValue={f?.reviewUrl ?? ""}
                  />
                  <Field
                    label="Testimonial (optional)"
                    name="testimonial"
                    required={false}
                    defaultValue={f?.testimonial ?? ""}
                  />
                  <Field label="Feedback notes" name="notes" defaultValue={f?.comments} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    name="consent"
                    type="checkbox"
                    value="yes"
                    defaultChecked={f?.publicationConsent}
                  />
                  Customer permits testimonial publication
                </label>
              </Form>
            )}
          </section>
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Service tickets & complaints</h2>
            {d.permissions.coordinate && d.permissions.service && (
              <Form
                title="Create service ticket"
                submit="Create ticket"
                busy={busy}
                onSubmit={(v) =>
                  run({
                    action: "ticket.create",
                    title: get(v, "title"),
                    description: get(v, "description"),
                    kind: get(v, "kind"),
                    assignedTo: get(v, "assignedTo"),
                    priority: get(v, "priority"),
                    dueAt: utcInput(get(v, "dueAt")),
                    notes: get(v, "notes"),
                  })
                }
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Ticket title" name="title" />
                  <Field label="Description" name="description" />
                  <Select
                    label="Request type"
                    name="kind"
                    values={[
                      { id: "service", name: "Service request" },
                      { id: "complaint", name: "Complaint" },
                    ]}
                  />
                  <Select label="Assigned engineer" name="assignedTo" values={engineers} />
                  <Select
                    label="Priority"
                    name="priority"
                    values={["low", "normal", "high", "urgent"].map((x) => ({ id: x, name: x }))}
                  />
                  <Field label="Due date (IST)" name="dueAt" type="datetime-local" />
                  <Field label="Service notes" name="notes" />
                </div>
              </Form>
            )}
            {d.tickets.map((t) => (
              <article key={t.id} className="space-y-4 rounded-xl border bg-white p-5">
                <header className="flex flex-wrap justify-between gap-2">
                  <h3 className="font-semibold">{t.title}</h3>
                  <span className="text-xs">
                    {t.priority} · {t.status.replaceAll("_", " ")}
                  </span>
                </header>
                <p className="text-sm">{t.description}</p>
                <p className="text-xs text-muted-foreground">
                  Assigned:{" "}
                  {engineers.find((e) => e.id === t.assignedTo)?.name ?? "Employee unavailable"} ·
                  Due {dateTime(t.dueAt)}
                </p>
                {t.resolution && (
                  <p className="text-sm">
                    Resolution: {t.resolution} · {dateTime(t.resolvedAt)}
                  </p>
                )}
                {files(
                  "ticket_photo",
                  t.id,
                  d.permissions.service &&
                    t.status !== "closed" &&
                    (d.permissions.coordinate || t.assignedTo === d.currentUserId),
                )}
                {d.permissions.coordinate && t.status !== "closed" && (
                  <Form
                    title="Update ticket assignment"
                    submit="Save assignment"
                    busy={busy}
                    onSubmit={(v) =>
                      run({
                        action: "ticket.assign",
                        id: t.id,
                        version: t.version,
                        assignedTo: get(v, "assignedTo"),
                        priority: get(v, "priority"),
                        dueAt: utcInput(get(v, "dueAt")),
                        notes: get(v, "notes"),
                      })
                    }
                  >
                    <Select
                      label="Responsible engineer"
                      name="assignedTo"
                      values={engineers}
                      defaultValue={t.assignedTo ?? ""}
                    />
                    <Select
                      label="Ticket priority"
                      name="priority"
                      values={["low", "normal", "high", "urgent"].map((x) => ({ id: x, name: x }))}
                      defaultValue={t.priority}
                    />
                    <Field
                      label="Ticket due date (IST)"
                      name="dueAt"
                      type="datetime-local"
                      defaultValue={localInput(t.dueAt)}
                    />
                    <Field label="Reassignment reason" name="notes" />
                  </Form>
                )}
                {d.permissions.service &&
                  (d.permissions.coordinate || t.assignedTo === d.currentUserId) && (
                    <Form
                      title="Update ticket status"
                      submit="Record ticket update"
                      busy={busy}
                      onSubmit={(v) =>
                        run({
                          action: "ticket.status",
                          id: t.id,
                          version: t.version,
                          status: get(v, "status"),
                          notes: get(v, "notes"),
                        })
                      }
                    >
                      <Select
                        label="Next ticket status"
                        name="status"
                        values={(
                          {
                            open: ["in_progress"],
                            in_progress: ["waiting_customer", "resolved"],
                            waiting_customer: ["in_progress", "resolved"],
                            resolved: d.permissions.coordinate ? ["closed", "open"] : [],
                            closed: d.permissions.coordinate ? ["open"] : [],
                          } as Record<string, string[]>
                        )[t.status].map((x) => ({ id: x, name: x.replaceAll("_", " ") }))}
                      />
                      <Field label="Resolution / update notes" name="notes" />
                    </Form>
                  )}
              </article>
            ))}
            {!d.tickets.length && (
              <p className="rounded-xl border border-dashed p-6 text-sm">
                No service tickets for this order.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
