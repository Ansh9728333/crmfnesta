"use client";
import Link from "next/link";
import { cloneElement, useId, useState, type ReactElement, type ReactNode } from "react";
import { CalendarClock, FileText, Handshake, MapPin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Directory, LeadDetail, Serialized } from "@/features/leads/types";
import {
  dateTime,
  leadInput,
  localInput,
  money,
  requestJson,
  selectClass,
  utcInput,
} from "@/features/leads/utils";
import type { presalesService } from "@/lib/presales/service";
import { quotationSchema } from "@/lib/presales/validation";
import { priceQuotation } from "@/lib/presales/pricing";
type Workflow = Serialized<Awaited<ReturnType<ReturnType<typeof presalesService>["detail"]>>>;
type Item = {
  name: string;
  description: string;
  productCompanyId: string;
  quantity: string;
  unitPrice: string;
  discount: string;
};
type Visit = Workflow["visits"][number];
function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-2 text-xs font-medium">
      <label className="block" htmlFor={id}>
        {label}
      </label>
      {cloneElement(children as ReactElement<{ id: string }>, { id })}
    </div>
  );
}
function Text({
  label,
  value,
  onChange,
  required = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <Field label={label}>
      <Input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
function Notes({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <Field label={label}>
      <textarea
        className="min-h-24 w-full rounded-lg border bg-white p-3 font-normal"
        value={value}
        required={required}
        maxLength={4000}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
const card = "min-w-0 space-y-5 rounded-xl border bg-white p-5 sm:p-6 [overflow-wrap:anywhere]";
const now = () => localInput(new Date().toISOString());
export function PresalesWorkspace({
  initial,
  initialLead,
  directory,
  initialTab = "visits",
}: {
  initial: Workflow;
  initialLead: LeadDetail;
  directory: Directory;
  initialTab?: string;
}) {
  const [state, setState] = useState(initial),
    [leadDetail, setLeadDetail] = useState(initialLead),
    [tab, setTab] = useState(initialTab),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const lead = leadDetail.lead,
    latest = state.page === 1 ? state.quotations[0] : undefined;
  const blankItem = (): Item => ({
    name: "",
    description: "",
    productCompanyId: lead.organizationId,
    quantity: "1",
    unitPrice: "0",
    discount: "0",
  });
  const [visitId, setVisitId] = useState(""),
    [visitVersion, setVisitVersion] = useState(1),
    [assignedTo, setAssignedTo] = useState(lead.assignedTo ?? ""),
    [scheduledAt, setScheduledAt] = useState(now),
    [visitStatus, setVisitStatus] = useState("scheduled"),
    [observations, setObservations] = useState(""),
    [measurements, setMeasurements] = useState<{ label: string; value: string; unit: string }[]>(
      [],
    ),
    [nextDate, setNextDate] = useState(""),
    [nextAction, setNextAction] = useState("");
  const [items, setItems] = useState<Item[]>([blankItem()]),
    [customerNotes, setCustomerNotes] = useState(""),
    [revisionReason, setRevisionReason] = useState(""),
    [decision, setDecision] = useState("accepted"),
    [evidence, setEvidence] = useState("");
  const [engagementKind, setEngagementKind] = useState("showroom"),
    [occurredAt, setOccurredAt] = useState(now),
    [outcome, setOutcome] = useState(""),
    [notRequired, setNotRequired] = useState(false),
    [reason, setReason] = useState(""),
    [notes, setNotes] = useState(""),
    [offer, setOffer] = useState("");
  const [companyConfirmed, setCompanyConfirmed] = useState(""),
    [quoteConfirmed, setQuoteConfirmed] = useState(""),
    [quantitiesConfirmed, setQuantitiesConfirmed] = useState(false),
    [finalValue, setFinalValue] = useState(""),
    [lostReason, setLostReason] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [fileVisit, setFileVisit] = useState("");
  let pricing: ReturnType<typeof priceQuotation> | null = null;
  try {
    pricing = priceQuotation(quotationSchema.parse({ items, expectedRevision: 0 }));
  } catch {}
  async function reload(page = state.page) {
    const [workflow, detail] = await Promise.all([
      requestJson<Workflow>(`/api/leads/${lead.id}/presales?page=${page}`),
      requestJson<LeadDetail>(`/api/leads/${lead.id}`),
    ]);
    setState(workflow);
    setLeadDetail(detail);
  }
  async function run(action: string, data: unknown, after?: () => void) {
    setBusy(true);
    setError("");
    try {
      await requestJson(`/api/leads/${lead.id}/presales`, "POST", { action, data });
      await reload(1);
      after?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }
  function editVisit(v: Visit) {
    setVisitId(v.id);
    setVisitVersion(v.version);
    setAssignedTo(v.assignedTo ?? "");
    setScheduledAt(localInput(v.scheduledAt));
    setVisitStatus(v.status);
    setObservations(v.observations ?? "");
    setMeasurements(v.measurements);
    setNextDate("");
    setNextAction("");
  }
  function resetVisit() {
    setVisitId("");
    setVisitVersion(1);
    setVisitStatus("scheduled");
    setObservations("");
    setMeasurements([]);
    setScheduledAt(now());
    setNextDate("");
    setNextAction("");
  }
  const salesPeople = [
    ...new Map(
      directory.employees
        .filter((p) => p.organizationId === lead.organizationId && p.centreId === lead.centreId)
        .map((p) => [p.id, p]),
    ).values(),
  ];
  const tabs = [
    ["visits", "Site visits", CalendarClock],
    ["quotations", "Quotations", FileText],
    ["engagements", "Showroom & negotiation", Handshake],
    ["conversion", "Order conversion", MapPin],
  ] as const;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/leads/${lead.id}`} className="text-xs font-semibold text-primary">
            ← Lead details & complete timeline
          </Link>
          <p className="mt-4 text-xs text-muted-foreground">
            {lead.companyName} · {lead.projectName}
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{lead.clientName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Pre-sales workspace · {lead.mobile}</p>
        </div>
        <Badge variant="outline">{lead.outcome ?? "Open"}</Badge>
      </header>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Pre-sales modules">
        {tabs.map(([id, label, Icon]) => (
          <Button
            key={id}
            role="tab"
            aria-selected={tab === id}
            variant={tab === id ? "default" : "outline"}
            onClick={() => {
              setTab(id);
              window.history.replaceState(null, "", `?tab=${id}`);
            }}
          >
            <Icon size={15} />
            {label}
          </Button>
        ))}
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-white p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {!state.canWrite && (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          This workspace is read only. Closed and archived lead history remains available.
        </p>
      )}
      {tab === "visits" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className={card}>
            <h2 className="font-semibold">Appointments & initial site visits</h2>
            {!state.visits.length && (
              <p className="text-sm text-muted-foreground">No site visits recorded on this page.</p>
            )}
            {state.visits.map((v) => (
              <article key={v.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <h3 className="text-sm font-semibold">{dateTime(v.scheduledAt)}</h3>
                  <Badge variant="outline">{v.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {v.assignedName ?? "Unassigned"} · Updated {dateTime(v.updatedAt)}
                </p>
                {v.observations && <p className="whitespace-pre-wrap text-sm">{v.observations}</p>}
                {v.measurements.length > 0 && (
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    {v.measurements.map((m, i) => (
                      <div key={i}>
                        <dt className="text-muted-foreground">{m.label}</dt>
                        <dd>
                          {m.value} {m.unit}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {state.canWrite &&
                  state.canVisit &&
                  ["scheduled", "confirmed"].includes(v.status) && (
                    <Button size="sm" variant="outline" onClick={() => editVisit(v)}>
                      Edit appointment
                    </Button>
                  )}
              </article>
            ))}
            <p className="text-xs text-muted-foreground">
              Every schedule, status, assignment and measurement change is retained in the lead
              timeline.
            </p>
          </section>
          {state.canVisit && state.canWrite && (
            <form
              className={card}
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  "appointment",
                  {
                    id: visitId || undefined,
                    version: visitId ? visitVersion : undefined,
                    assignedTo,
                    scheduledAt: utcInput(scheduledAt),
                    status: visitStatus,
                    observations,
                    measurements,
                    nextFollowUp: utcInput(nextDate),
                    nextAction,
                  },
                  resetVisit,
                );
              }}
            >
              <h2 className="font-semibold">
                {visitId ? "Update appointment" : "Schedule site visit"}
              </h2>
              <Field label="Sales executive">
                <select
                  className={selectClass}
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  required
                >
                  <option value="">Select employee</option>
                  {salesPeople.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Text
                label="Appointment date and time (IST)"
                type="datetime-local"
                value={scheduledAt}
                onChange={setScheduledAt}
                required
              />
              <Field label="Visit status">
                <select
                  className={selectClass}
                  value={visitStatus}
                  onChange={(e) => setVisitStatus(e.target.value)}
                >
                  {["scheduled", "confirmed", "completed", "cancelled", "no-show"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Notes
                label="Site observations"
                value={observations}
                onChange={setObservations}
                required={visitStatus === "completed"}
              />
              <h3 className="text-sm font-medium">Initial measurements</h3>
              {measurements.map((m, index) => (
                <div className="grid gap-2 rounded-lg border p-3" key={index}>
                  <Text
                    label={`Measurement ${index + 1} label`}
                    value={m.label}
                    onChange={(value) =>
                      setMeasurements((prev) =>
                        prev.map((r, i) => (i === index ? { ...r, label: value } : r)),
                      )
                    }
                    required
                  />
                  <div className="flex gap-2">
                    <Text
                      label={`Measurement ${index + 1} value`}
                      value={m.value}
                      onChange={(value) =>
                        setMeasurements((prev) =>
                          prev.map((r, i) => (i === index ? { ...r, value } : r)),
                        )
                      }
                      required
                    />
                    <Field label="Unit">
                      <select
                        className={selectClass}
                        value={m.unit}
                        onChange={(e) =>
                          setMeasurements((prev) =>
                            prev.map((r, i) => (i === index ? { ...r, unit: e.target.value } : r)),
                          )
                        }
                      >
                        {["mm", "cm", "m", "ft", "in", "sq ft", "sq m", "count"].map((u) => (
                          <option key={u}>{u}</option>
                        ))}
                      </select>
                    </Field>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove measurement ${index + 1}`}
                      onClick={() => setMeasurements((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={measurements.length >= 100}
                onClick={() =>
                  setMeasurements((prev) => [...prev, { label: "", value: "", unit: "mm" }])
                }
              >
                <Plus size={14} />
                Add measurement
              </Button>
              <Text
                label="Next follow-up (IST)"
                type="datetime-local"
                value={nextDate}
                onChange={setNextDate}
              />
              <Text
                label="Next follow-up action"
                value={nextAction}
                onChange={setNextAction}
                required={!!nextDate}
              />
              <div className="flex gap-2">
                <Button disabled={busy}>{visitId ? "Save appointment" : "Schedule visit"}</Button>
                {visitId && (
                  <Button type="button" variant="ghost" onClick={resetVisit}>
                    Cancel edit
                  </Button>
                )}
              </div>
            </form>
          )}
          <section className={`${card} xl:col-span-2`}>
            <h2 className="font-semibold">Private photos & documents</h2>
            <p className="text-xs text-muted-foreground">
              PDF, JPEG or PNG · maximum 4 MiB · private downloads expire after 60 seconds.
            </p>
            {state.files.map((f) => (
              <div
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm">{f.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {dateTime(f.createdAt)} · {Math.ceil(f.byteSize / 1024)} KB{" "}
                    {f.appointmentId ? "· linked to appointment" : "· lead attachment"}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const result = await requestJson<{ url: string }>(
                        `/api/leads/${lead.id}/attachments/${f.id}`,
                      );
                      window.location.assign(result.url);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Download
                </Button>
              </div>
            ))}
            {!state.files.length && (
              <p className="text-sm text-muted-foreground">No attachments on this page.</p>
            )}
            {state.canVisit && state.canWrite && (
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formElement = e.currentTarget;
                  if (!file) return;
                  setBusy(true);
                  setError("");
                  try {
                    const form = new FormData();
                    form.set("file", file);
                    if (fileVisit) form.set("appointmentId", fileVisit);
                    const response = await fetch(`/api/leads/${lead.id}/attachments`, {
                      method: "POST",
                      body: form,
                    });
                    if (!response.ok) {
                      const result = await response.json();
                      throw new Error(result.error ?? "Upload failed");
                    }
                    await reload(1);
                    setFile(null);
                    formElement.reset();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Field label="Photo or document">
                  <Input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    required
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </Field>
                <Field label="Related appointment">
                  <select
                    className={selectClass}
                    value={fileVisit}
                    onChange={(e) => setFileVisit(e.target.value)}
                  >
                    <option value="">Lead attachment</option>
                    {state.visits.map((v) => (
                      <option key={v.id} value={v.id}>
                        {dateTime(v.scheduledAt)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Button disabled={busy || !file}>Upload privately</Button>
              </form>
            )}
          </section>
        </div>
      )}
      {tab === "quotations" && (
        <div className="space-y-6">
          {!state.canQuote && (
            <p className={card}>Quotation access requires quotation management permission.</p>
          )}
          {state.canQuote && state.canWrite && state.page === 1 && (
            <form
              className={card}
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  "quotation",
                  { expectedRevision: latest?.revision ?? 0, revisionReason, customerNotes, items },
                  () => {
                    setRevisionReason("");
                    setEvidence("");
                  },
                );
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">
                    {latest ? `Create V${latest.revision + 1} revision` : "Create quotation V1"}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Every submission creates an immutable version. Item discounts are INR amounts.
                  </p>
                </div>
                {latest && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setItems(
                        latest.items.map((i) => ({
                          name: i.name ?? "Item",
                          description: i.description,
                          productCompanyId: i.productCompanyId ?? lead.organizationId,
                          quantity: i.quantity,
                          unitPrice: i.unitPrice,
                          discount: i.discount,
                        })),
                      );
                      setCustomerNotes(latest.customerNotes ?? "");
                    }}
                  >
                    Copy latest items
                  </Button>
                )}
              </div>
              {items.map((item, index) => (
                <fieldset key={index} className="space-y-3 rounded-lg border bg-background/40 p-4">
                  <legend className="px-2 text-xs font-semibold">Item {index + 1}</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Text
                      label={`Item ${index + 1} name`}
                      value={item.name}
                      required
                      onChange={(v) =>
                        setItems((prev) =>
                          prev.map((r, i) => (i === index ? { ...r, name: v } : r)),
                        )
                      }
                    />
                    <Field label={`Item ${index + 1} product company`}>
                      <select
                        className={selectClass}
                        value={item.productCompanyId}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((r, i) =>
                              i === index ? { ...r, productCompanyId: e.target.value } : r,
                            ),
                          )
                        }
                      >
                        <option value={lead.organizationId}>{lead.companyName}</option>
                      </select>
                    </Field>
                  </div>
                  <Notes
                    label={`Item ${index + 1} description`}
                    value={item.description}
                    onChange={(v) =>
                      setItems((prev) =>
                        prev.map((r, i) => (i === index ? { ...r, description: v } : r)),
                      )
                    }
                  />
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(
                      [
                        ["quantity", "Quantity"],
                        ["unitPrice", "Unit rate (INR)"],
                        ["discount", "Discount (INR)"],
                      ] as const
                    ).map(([key, label]) => (
                      <Text
                        key={key}
                        label={`Item ${index + 1} ${label}`}
                        value={item[key]}
                        required
                        onChange={(v) =>
                          setItems((prev) =>
                            prev.map((r, i) => (i === index ? { ...r, [key]: v } : r)),
                          )
                        }
                      />
                    ))}
                  </div>
                  {pricing?.items[index] && (
                    <p className="text-xs text-muted-foreground">
                      Subtotal {money(pricing.items[index].subtotal)} · Final{" "}
                      {money(pricing.items[index].amount)}
                    </p>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={items.length === 1}
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 size={14} />
                    Remove item
                  </Button>
                </fieldset>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={items.length >= 50}
                onClick={() => setItems((prev) => [...prev, blankItem()])}
              >
                <Plus size={14} />
                Add item
              </Button>
              <Notes label="Customer notes" value={customerNotes} onChange={setCustomerNotes} />
              {latest && (
                <Notes
                  label="Revision reason"
                  value={revisionReason}
                  onChange={setRevisionReason}
                  required
                />
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-accent p-4">
                <p className="text-sm">
                  Subtotal {money(pricing?.subtotal)} · Discount {money(pricing?.discount)}
                  <strong className="mt-2 block text-lg">Final {money(pricing?.amount)}</strong>
                </p>
                <Button disabled={busy || !pricing}>
                  Issue quotation {latest ? `V${latest.revision + 1}` : "V1"}
                </Button>
              </div>
            </form>
          )}
          {state.quotations.map((q) => (
            <article className={card} key={q.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">
                    Quotation V{q.revision}{" "}
                    <Badge variant="outline">{q.decisions[0]?.decision ?? "Issued"}</Badge>
                  </h2>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {dateTime(q.createdAt)} · {q.snapshot?.company ?? lead.companyName}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <a href={`/api/leads/${lead.id}/quotations/${q.id}/pdf`}>Download PDF</a>
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      {[
                        "Item",
                        "Company",
                        "Qty",
                        "Rate (INR)",
                        "Subtotal (INR)",
                        "Discount (INR)",
                        "Final (INR)",
                      ].map((h) => (
                        <th className="p-2" key={h}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {q.items.map((i) => (
                      <tr key={i.id} className="border-b">
                        <td className="min-w-40 p-2">
                          <strong>{i.name}</strong>
                          <p className="mt-1 whitespace-pre-wrap">{i.description}</p>
                        </td>
                        <td className="p-2">{q.snapshot?.company ?? lead.companyName}</td>
                        <td className="p-2">{i.quantity}</td>
                        <td className="p-2">{i.unitPrice}</td>
                        <td className="p-2">{i.subtotal}</td>
                        <td className="p-2">{i.discount}</td>
                        <td className="p-2">{i.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm">
                Subtotal {money(q.subtotal)} · Discount {money(q.discount)} ·{" "}
                <strong>Final {money(q.amount)}</strong>
              </p>
              {q.customerNotes && (
                <p className="whitespace-pre-wrap text-sm">Customer notes: {q.customerNotes}</p>
              )}
              {q.revisionReason && (
                <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                  Revision reason: {q.revisionReason}
                </p>
              )}
              <ol className="space-y-2 border-l pl-4">
                {q.decisions.map((d) => (
                  <li key={d.id} className="text-xs">
                    <strong>{d.decision}</strong> · {dateTime(d.createdAt)} · {d.actorName}
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{d.evidence}</p>
                  </li>
                ))}
              </ol>
              {q.id === latest?.id && state.canWrite && (
                <form
                  className="grid gap-3 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run("decision", { quotationId: q.id, decision, evidence }, () =>
                      setEvidence(""),
                    );
                  }}
                >
                  <Field label="Quotation decision">
                    <select
                      className={selectClass}
                      value={decision}
                      onChange={(e) => setDecision(e.target.value)}
                    >
                      <option value="accepted">Customer accepted</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </Field>
                  <Text
                    label="Approval or acceptance evidence"
                    value={evidence}
                    onChange={setEvidence}
                    required
                  />
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    Record who accepted or approved, the date and reference. This records evidence
                    supplied by your team; it does not collect an electronic signature.
                  </p>
                  <Button size="sm" disabled={busy}>
                    Record decision
                  </Button>
                </form>
              )}
            </article>
          ))}
          {!state.quotations.length && <p className={card}>No quotations on this page.</p>}
        </div>
      )}
      {tab === "engagements" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className={card}>
            <h2 className="font-semibold">Showroom & negotiation history</h2>
            {state.engagements.map((r) => (
              <article className="space-y-2 rounded-lg border p-4" key={r.id}>
                <Badge variant="outline">{r.kind}</Badge>
                <h3 className="text-sm font-semibold">
                  {r.notRequired ? "Not Required" : r.outcome}
                </h3>
                <p className="text-xs text-muted-foreground">{dateTime(r.occurredAt)}</p>
                {r.reason && <p className="text-sm">Reason: {r.reason}</p>}
                <p className="whitespace-pre-wrap text-sm">{r.notes}</p>
                {r.offeredValue && (
                  <p className="text-sm">Revised offer: {money(r.offeredValue)}</p>
                )}
              </article>
            ))}
            {!state.engagements.length && (
              <p className="text-sm text-muted-foreground">
                No showroom visits or negotiations on this page.
              </p>
            )}
          </section>
          {state.canWrite && (
            <form
              className={card}
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  "engagement",
                  {
                    kind: engagementKind,
                    occurredAt: utcInput(occurredAt),
                    outcome: notRequired ? "Not Required" : outcome,
                    notRequired,
                    reason,
                    notes,
                    offeredValue: offer,
                  },
                  () => {
                    setOutcome("");
                    setNotes("");
                    setReason("");
                    setOffer("");
                  },
                );
              }}
            >
              <h2 className="font-semibold">Record customer interaction</h2>
              <Field label="Interaction type">
                <select
                  className={selectClass}
                  value={engagementKind}
                  onChange={(e) => {
                    setEngagementKind(e.target.value);
                    setNotRequired(false);
                  }}
                >
                  <option value="showroom">Showroom visit</option>
                  <option value="negotiation">Negotiation</option>
                </select>
              </Field>
              <Text
                label="Interaction date and time (IST)"
                type="datetime-local"
                value={occurredAt}
                onChange={setOccurredAt}
                required
              />
              {engagementKind === "showroom" && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={notRequired}
                    onChange={(e) => setNotRequired(e.target.checked)}
                  />
                  Showroom visit Not Required
                </label>
              )}
              {notRequired ? (
                <Notes label="Not Required reason" value={reason} onChange={setReason} required />
              ) : (
                <Text label="Interaction outcome" value={outcome} onChange={setOutcome} required />
              )}
              <Notes
                label="Interaction notes"
                value={notes}
                onChange={setNotes}
                required={engagementKind === "negotiation"}
              />
              {engagementKind === "negotiation" && (
                <Text label="Revised offer (INR)" value={offer} onChange={setOffer} />
              )}
              <p className="text-xs text-muted-foreground">
                A negotiated offer becomes binding only after a quotation revision is approved or
                accepted.
              </p>
              <Button disabled={busy}>Record interaction</Button>
            </form>
          )}
        </div>
      )}
      {tab === "conversion" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className={card}>
            <h2 className="font-semibold">Quotation-backed order conversion</h2>
            {state.order ? (
              <>
                <p className="text-sm">Order created {dateTime(state.order.createdAt)}</p>
                <p className="text-lg font-semibold">{money(state.order.finalValue)}</p>
                <p className="text-sm">Final quantity: {state.order.finalQuantity}</p>
                <Button asChild>
                  <Link href={`/orders/${state.order.id}`}>
                    View order & post-sales initialization
                  </Link>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Complete the pre-sales stages through negotiation. Confirm the latest approved or
                accepted quotation, company, final value and all item quantities. Conversion creates
                one linked order and initializes the shared post-sales workflow.
              </p>
            )}
            {lead.closedAt && (
              <p className="text-sm">
                Closed {dateTime(lead.closedAt)}
                {lead.lossReason ? ` · ${lead.lossReason}` : ""}
              </p>
            )}
          </section>
          {state.canWrite && (
            <div className="space-y-6">
              <form
                className={card}
                onSubmit={(e) => {
                  e.preventDefault();
                  void run("convert", {
                    version: lead.version,
                    organizationId: companyConfirmed,
                    quotationId: quoteConfirmed,
                    finalValue,
                    quantitiesConfirmed,
                  });
                }}
              >
                <h2 className="font-semibold">Confirm Won</h2>
                <Field label="Confirm selected company">
                  <select
                    className={selectClass}
                    value={companyConfirmed}
                    required
                    onChange={(e) => setCompanyConfirmed(e.target.value)}
                  >
                    <option value="">Confirm company</option>
                    <option value={lead.organizationId}>{lead.companyName}</option>
                  </select>
                </Field>
                <Field label="Approved or accepted quotation">
                  <select
                    className={selectClass}
                    value={quoteConfirmed}
                    required
                    onChange={(e) => {
                      setQuoteConfirmed(e.target.value);
                      setFinalValue(latest?.amount ?? "");
                      setQuantitiesConfirmed(false);
                    }}
                  >
                    <option value="">Select latest quotation</option>
                    {latest && ["approved", "accepted"].includes(latest.decisions[0]?.decision) && (
                      <option value={latest.id}>
                        V{latest.revision} · {money(latest.amount)} · {latest.decisions[0].decision}
                      </option>
                    )}
                  </select>
                </Field>
                {latest && (
                  <ul className="space-y-2 rounded-lg border p-4 text-xs">
                    {latest.items.map((i) => (
                      <li key={i.id}>
                        {i.name}: {i.quantity} × {money(i.unitPrice)}
                      </li>
                    ))}
                  </ul>
                )}
                <Text
                  label="Final order value (INR)"
                  value={finalValue}
                  onChange={setFinalValue}
                  required
                />
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={quantitiesConfirmed}
                    required
                    onChange={(e) => setQuantitiesConfirmed(e.target.checked)}
                  />
                  I confirm all final quantities from the selected quotation. Changed quantities or
                  values require a new approved revision.
                </label>
                <Button disabled={busy || lead.stage !== 6 || !latest || !quantitiesConfirmed}>
                  Convert to order
                </Button>
              </form>
              <form
                className={card}
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError("");
                  try {
                    await requestJson(`/api/leads/${lead.id}`, "PATCH", {
                      version: lead.version,
                      data: {
                        ...leadInput(lead),
                        stage: 7,
                        outcome: "lost",
                        lossReason: lostReason,
                      },
                    });
                    await reload(1);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <h2 className="font-semibold">Close as Lost</h2>
                <Notes
                  label="Lost closure reason"
                  value={lostReason}
                  onChange={setLostReason}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Closure time is recorded automatically. All visits, quotations, documents and
                  customer history are preserved.
                </p>
                <Button variant="outline" disabled={busy || lostReason.trim().length < 3}>
                  Mark Lost
                </Button>
              </form>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          disabled={busy || state.page === 1}
          onClick={() => {
            setBusy(true);
            reload(state.page - 1)
              .catch((e) => setError(e.message))
              .finally(() => setBusy(false));
          }}
        >
          Newer workflow records
        </Button>
        <span className="text-xs text-muted-foreground">Page {state.page}</span>
        <Button
          variant="ghost"
          disabled={busy || !state.hasMore}
          onClick={() => {
            setBusy(true);
            reload(state.page + 1)
              .catch((e) => setError(e.message))
              .finally(() => setBusy(false));
          }}
        >
          Older workflow records
        </Button>
      </div>
    </div>
  );
}
