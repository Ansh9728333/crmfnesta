"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Labeled } from "@/features/orders/fields";
import { dateTime, localInput, money, selectClass, utcInput } from "@/features/leads/utils";
import Decimal from "decimal.js";
import type { CommerceDetail } from "./types";
import { Field, Form, get, type Command, type FileRenderer } from "./shared";
function MilestoneForm({
  d,
  command,
  busy,
}: {
  d: CommerceDetail;
  command: Command;
  busy: boolean;
}) {
  const [templateId, setTemplateId] = useState(""),
    template = d.templates.find((t) => t.id === templateId);
  const [selected, setSelected] = useState(""),
    existing = d.milestones.find((m) => m.id === selected);
  return (
    <div className="space-y-3">
      {!selected && d.templates.length > 0 && (
        <Labeled label="Company payment template">
          {(id) => (
            <select
              id={id}
              className={selectClass}
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">Custom milestone</option>
              {d.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </Labeled>
      )}
      <Labeled label="Configure milestone">
        {(id) => (
          <select
            id={id}
            className={selectClass}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Create a milestone</option>
            {d.milestones
              .filter((m) => new Decimal(m.allocatedAmount).eq(0))
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
        )}
      </Labeled>
      <Form
        key={`${selected}-${templateId}`}
        title="Admin payment milestone configuration"
        submit="Save milestone"
        busy={busy}
        onSubmit={(f) =>
          command({
            action: "milestone.save",
            ...(existing ? { id: existing.id } : {}),
            version: existing?.version ?? 0,
            loadId: get(f, "loadId"),
            name: get(f, "name"),
            amount: get(f, "amount"),
            dueAt: get(f, "dueAt") ? utcInput(get(f, "dueAt")) : undefined,
            beforeDispatch: f.get("beforeDispatch") === "on",
            contractReference: get(f, "contractReference"),
            notes: get(f, "notes"),
          })
        }
      >
        <Labeled label="Milestone production load">
          {(id) => (
            <select
              id={id}
              name="loadId"
              className={selectClass}
              required
              defaultValue={existing?.loadId ?? ""}
            >
              <option value="">Select load</option>
              {d.loads.map((l) => (
                <option key={l.id} value={l.id}>
                  Load {l.loadNumber}
                </option>
              ))}
            </select>
          )}
        </Labeled>
        <Field label="Milestone name" name="name" defaultValue={existing?.name ?? template?.name} />
        <Field
          label="Amount due (INR)"
          name="amount"
          type="number"
          defaultValue={
            existing?.amount ??
            (template
              ? new Decimal(d.order.finalValue ?? "0")
                  .times(String(template.config.percentage))
                  .div(100)
                  .toFixed(2)
              : undefined)
          }
        />
        <Field
          label="Milestone due date (IST)"
          name="dueAt"
          type="datetime-local"
          required={false}
          defaultValue={localInput(
            existing?.dueAt ??
              (template
                ? new Date(
                    new Date(d.order.createdAt).getTime() +
                      Number(template.config.offsetDays) * 86400000,
                  )
                : null),
          )}
        />
        <Field
          label="Contract reference"
          name="contractReference"
          defaultValue={existing?.contractReference}
        />
        <Field
          label="Configuration reason / approved terms"
          name="notes"
          defaultValue={existing?.notes}
        />
        <label className="flex gap-3 text-xs">
          <input
            name="beforeDispatch"
            type="checkbox"
            defaultChecked={
              existing?.beforeDispatch ??
              (template ? Boolean(template.config.beforeDispatch) : true)
            }
          />
          Required before dispatch
        </label>
        <label className="flex gap-3 text-xs">
          <input type="checkbox" required />I confirm these terms match the approved customer
          contract.
        </label>
        <p className="text-xs text-muted-foreground">
          Milestones cannot exceed the order value. Funded or approved shipment terms are locked;
          cumulative approved contract requirements also apply.
        </p>
      </Form>
    </div>
  );
}
export function PaymentsPanel({
  d,
  command,
  busy,
  filePanel,
}: {
  d: CommerceDetail;
  command: Command;
  busy: boolean;
  filePanel: FileRenderer;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="min-w-0 space-y-6">
        <section className="space-y-4 rounded-xl border bg-white p-5">
          <h2 className="font-semibold">Payment milestones</h2>
          {d.milestones.map((m) => (
            <div key={m.id} className="space-y-2 rounded-lg border p-4 text-xs">
              <div className="flex flex-wrap justify-between gap-2">
                <strong>
                  {m.name} · Load {d.loads.find((l) => l.id === m.loadId)?.loadNumber}
                </strong>
                <Badge
                  variant={new Decimal(m.allocatedAmount).eq(m.amount) ? "default" : "secondary"}
                >
                  {new Decimal(m.allocatedAmount).eq(m.amount) ? "Funded" : "Payment pending"}
                </Badge>
              </div>
              <p>
                Due {money(m.amount)} · Verified allocated {money(m.allocatedAmount)} · Remaining{" "}
                {money(new Decimal(m.amount).minus(m.allocatedAmount).toFixed(2))}
              </p>
              <p>
                {m.beforeDispatch ? "Required before dispatch" : "Later installment"} ·{" "}
                {dateTime(m.dueAt)}
              </p>
              <p className="break-words">Contract: {m.contractReference}</p>
              <p className="whitespace-pre-wrap break-words text-muted-foreground">{m.notes}</p>
            </div>
          ))}
          {!d.milestones.length && (
            <p className="text-sm text-muted-foreground">
              An Admin must configure the load’s contractual payment milestones before dispatch.
            </p>
          )}
        </section>
        <section className="space-y-4">
          <h2 className="font-semibold">Installments & receipt verification</h2>
          {d.payments.map((p) => (
            <article key={p.id} className="space-y-4 rounded-xl border bg-white p-5">
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="font-semibold">
                  {money(p.amount)} · {p.reference}
                </h3>
                <Badge variant={p.status === "verified" ? "default" : "secondary"}>
                  {p.status}
                </Badge>
              </div>
              <p className="text-xs">
                {p.mode.replaceAll("_", " ")} · {dateTime(p.receivedAt)} · Unallocated{" "}
                {money(new Decimal(p.amount).minus(p.allocatedAmount).toFixed(2))}
              </p>
              <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                {p.notes}
              </p>
              {p.verifiedBy && (
                <p className="break-all text-xs">
                  Verified by {p.verifiedBy} · {dateTime(p.verifiedAt)}
                </p>
              )}
              {p.rejectionReason && (
                <p className="text-xs text-destructive">Rejected: {p.rejectionReason}</p>
              )}
              {filePanel("payment", p.id, p.status === "pending" && d.permissions.payments)}
              {p.status === "pending" && d.permissions.payments && (
                <form
                  className="space-y-3 border-t pt-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void command({
                      action: get(f, "decision") === "verify" ? "payment.verify" : "payment.reject",
                      id: p.id,
                      version: p.version,
                      notes: get(f, "notes"),
                    });
                  }}
                >
                  <Field label={`Accounts decision notes ${p.reference}`} name="notes" />
                  <Labeled label={`Accounts decision ${p.reference}`}>
                    {(id) => (
                      <select id={id} name="decision" className={selectClass}>
                        <option value="verify">Verify receipt against actual evidence</option>
                        <option value="reject">Reject receipt</option>
                      </select>
                    )}
                  </Labeled>
                  <label className="flex gap-3 text-xs">
                    <input type="checkbox" required />I confirm this Accounts decision and its
                    evidence.
                  </label>
                  <Button disabled={busy}>Record Accounts decision</Button>
                </form>
              )}
              <div className="space-y-2 text-xs">
                {d.allocations
                  .filter((a) => a.paymentId === p.id)
                  .map((a) => (
                    <p key={a.id}>
                      Allocated {money(a.amount)} →{" "}
                      {d.milestones.find((m) => m.id === a.milestoneId)?.name}
                    </p>
                  ))}
              </div>
            </article>
          ))}
          {!d.payments.length && (
            <p className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
              {d.permissions.payments
                ? "No installments have been recorded."
                : "Receipt details are restricted to Accounts. Load milestone funding remains visible."}
            </p>
          )}
        </section>
      </div>
      <aside className="min-w-0 space-y-6">
        {d.permissions.payments && (
          <>
            <Form
              title="Record installment"
              submit="Add installment"
              busy={busy}
              onSubmit={(f) =>
                command({
                  action: "payment.record",
                  amount: get(f, "amount"),
                  mode: get(f, "mode"),
                  reference: get(f, "reference"),
                  receivedAt: utcInput(get(f, "receivedAt")),
                  notes: get(f, "notes"),
                })
              }
            >
              <Field label="Amount received (INR)" name="amount" type="number" />
              <Labeled label="Payment mode">
                {(id) => (
                  <select id={id} name="mode" className={selectClass}>
                    {["bank_transfer", "upi", "card", "cheque", "cash", "other"].map((m) => (
                      <option value={m} key={m}>
                        {m.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                )}
              </Labeled>
              <Field label="Transaction / receipt reference" name="reference" />
              <Field label="Payment date (IST)" name="receivedAt" type="datetime-local" />
              <Field label="Payment notes" name="notes" />
            </Form>
            <Form
              title="Allocate verified payment"
              submit="Allocate payment"
              busy={busy}
              onSubmit={(f) =>
                command({
                  action: "payment.allocate",
                  paymentId: get(f, "paymentId"),
                  milestoneId: get(f, "milestoneId"),
                  amount: get(f, "amount"),
                  notes: get(f, "notes"),
                })
              }
            >
              <Labeled label="Verified installment">
                {(id) => (
                  <select required id={id} name="paymentId" className={selectClass}>
                    <option value="">Select receipt</option>
                    {d.payments
                      .filter(
                        (p) =>
                          p.status === "verified" && new Decimal(p.amount).gt(p.allocatedAmount),
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.reference} ·{" "}
                          {money(new Decimal(p.amount).minus(p.allocatedAmount).toFixed(2))}
                        </option>
                      ))}
                  </select>
                )}
              </Labeled>
              <Labeled label="Load payment milestone">
                {(id) => (
                  <select required id={id} name="milestoneId" className={selectClass}>
                    <option value="">Select milestone</option>
                    {d.milestones
                      .filter((m) => new Decimal(m.amount).gt(m.allocatedAmount))
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} · Load {d.loads.find((l) => l.id === m.loadId)?.loadNumber}
                        </option>
                      ))}
                  </select>
                )}
              </Labeled>
              <Field label="Allocation amount (INR)" name="amount" type="number" />
              <Field label="Allocation reason" name="notes" />
            </Form>
          </>
        )}
        {d.permissions.configure && <MilestoneForm d={d} busy={busy} command={command} />}
      </aside>
    </div>
  );
}
