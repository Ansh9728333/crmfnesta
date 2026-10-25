"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Labeled } from "@/features/orders/fields";
import { dateTime, selectClass, utcInput } from "@/features/leads/utils";
import Decimal from "decimal.js";
import type { CommerceDetail } from "./types";
import { Field, Form, get, type Command, type FileRenderer } from "./shared";
export function ShippingPanel({
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
  const [selectedLoad, setSelectedLoad] = useState(""),
    [selectedShipment, setSelectedShipment] = useState("");
  return (
    <>
      {d.permissions.production && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Form
            title="Create material dispatch"
            submit="Create dispatch draft"
            busy={busy}
            onSubmit={(f) =>
              command({
                action: "dispatch.create",
                loadId: selectedLoad,
                reference: get(f, "reference"),
                transporter: get(f, "transporter"),
                vehicleNumber: get(f, "vehicleNumber"),
                expectedAt: utcInput(get(f, "expectedAt")),
                notes: get(f, "notes"),
                items: d.loadItems
                  .filter(
                    (i) =>
                      i.loadId === selectedLoad && new Decimal(get(f, `qty-${i.id}`) || "0").gt(0),
                  )
                  .map((i) => ({ loadItemId: i.id, quantity: get(f, `qty-${i.id}`) })),
              })
            }
          >
            <Labeled label="Factory-ready production load">
              {(id) => (
                <select
                  required
                  id={id}
                  className={selectClass}
                  value={selectedLoad}
                  onChange={(e) => setSelectedLoad(e.target.value)}
                >
                  <option value="">Select factory-ready load</option>
                  {d.loads
                    .filter((l) => l.status === "factory_ready")
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        Load {l.loadNumber}
                      </option>
                    ))}
                </select>
              )}
            </Labeled>
            <div className="space-y-3">
              {d.loadItems
                .filter((i) => i.loadId === selectedLoad)
                .map((i) => (
                  <Labeled
                    label={`${i.name ?? i.description} dispatch quantity (remaining ${new Decimal(i.quantity).minus(i.dispatchedQuantity)})`}
                    key={i.id}
                  >
                    {(id) => (
                      <Input
                        id={id}
                        name={`qty-${i.id}`}
                        type="number"
                        min="0"
                        max={new Decimal(i.quantity).minus(i.dispatchedQuantity).toString()}
                        step="0.001"
                      />
                    )}
                  </Labeled>
                ))}
            </div>
            <Field label="Tracking / dispatch reference" name="reference" />
            <Field label="Transporter" name="transporter" />
            <Field label="Vehicle number" name="vehicleNumber" />
            <Field label="Expected delivery (IST)" name="expectedAt" type="datetime-local" />
            <Field label="Dispatch notes" name="notes" />
          </Form>
          <Form
            title="Record site delivery"
            submit="Create delivery draft"
            busy={busy}
            onSubmit={(f) =>
              command({
                action: "delivery.create",
                dispatchId: selectedShipment,
                deliveredAt: utcInput(get(f, "deliveredAt")),
                receivedBy: get(f, "receivedBy"),
                remarks: get(f, "remarks"),
                items: d.dispatchItems
                  .filter(
                    (i) =>
                      i.dispatchId === selectedShipment &&
                      (new Decimal(get(f, `received-${i.id}`) || "0").gt(0) ||
                        new Decimal(get(f, `missing-${i.id}`) || "0").gt(0)),
                  )
                  .map((i) => ({
                    dispatchItemId: i.id,
                    received: get(f, `received-${i.id}`) || "0",
                    damaged: get(f, `damaged-${i.id}`) || "0",
                    missing: get(f, `missing-${i.id}`) || "0",
                  })),
              })
            }
          >
            <Labeled label="Dispatched shipment">
              {(id) => (
                <select
                  required
                  id={id}
                  className={selectClass}
                  value={selectedShipment}
                  onChange={(e) => setSelectedShipment(e.target.value)}
                >
                  <option value="">Select shipment</option>
                  {d.dispatches
                    .filter((s) => ["dispatched", "partially_delivered"].includes(s.status))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.reference} · Load {d.loads.find((l) => l.id === s.loadId)?.loadNumber}
                      </option>
                    ))}
                </select>
              )}
            </Labeled>
            {d.dispatchItems
              .filter((i) => i.dispatchId === selectedShipment)
              .map((i) => (
                <fieldset key={i.id} className="space-y-3 rounded-lg border p-3">
                  <legend className="max-w-full break-words px-1 text-xs font-medium">
                    {d.loadItems.find((l) => l.id === i.loadItemId)?.name ?? "Order item"} ·{" "}
                    {new Decimal(i.quantity).minus(i.deliveredQuantity).toString()} outstanding
                  </legend>
                  {[
                    ["received", "Site received quantity"],
                    ["damaged", "Damaged quantity (part of received)"],
                    ["missing", "Missing quantity reported now"],
                  ].map(([key, label]) => (
                    <Labeled key={key} label={label}>
                      {(id) => (
                        <Input
                          id={id}
                          name={`${key}-${i.id}`}
                          type="number"
                          min="0"
                          step="0.001"
                          defaultValue="0"
                        />
                      )}
                    </Labeled>
                  ))}
                </fieldset>
              ))}
            <Field label="Actual delivery date (IST)" name="deliveredAt" type="datetime-local" />
            <Field label="Received by" name="receivedBy" />
            <Field label="Delivery remarks" name="remarks" />
            <p className="text-xs text-muted-foreground">
              Missing quantities remain outstanding and may arrive in a later receipt. Damaged
              quantities are part of material received and remain flagged for installation and audit
              review.
            </p>
          </Form>
        </div>
      )}
      <section className="space-y-4">
        <h2 className="font-semibold">Material dispatches</h2>
        <div className="grid gap-5 xl:grid-cols-2">
          {d.dispatches.map((s) => (
            <article key={s.id} className="min-w-0 space-y-4 rounded-xl border bg-white p-5">
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="font-semibold">
                  {s.reference} · Load {d.loads.find((l) => l.id === s.loadId)?.loadNumber}
                </h3>
                <Badge>{s.status.replaceAll("_", " ")}</Badge>
              </div>
              <p className="text-xs">
                {s.transporter} · Vehicle {s.vehicleNumber}
              </p>
              <p className="text-xs">
                Expected: {dateTime(s.expectedAt)} · Dispatched: {dateTime(s.dispatchedAt)}
              </p>
              {s.approvedBy && (
                <p className="break-all text-xs text-muted-foreground">
                  Approved by {s.approvedBy} · {dateTime(s.approvedAt)}
                </p>
              )}
              <div className="space-y-2 text-xs">
                {d.dispatchItems
                  .filter((i) => i.dispatchId === s.id)
                  .map((i) => (
                    <p key={i.id}>
                      {d.loadItems.find((l) => l.id === i.loadItemId)?.name ?? "Order item"}:{" "}
                      {i.quantity} shipment quantity · {i.deliveredQuantity} site received
                    </p>
                  ))}
              </div>
              {filePanel("dispatch", s.id, s.status === "draft" && d.permissions.production)}
              {["draft", "approved"].includes(s.status) &&
                (d.permissions.production || d.permissions.approve) && (
                  <form
                    className="space-y-3 border-t pt-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void command({
                        action: get(f, "action"),
                        id: s.id,
                        version: s.version,
                        ...(get(f, "action") === "dispatch.ship"
                          ? { dispatchedAt: utcInput(get(f, "dispatchedAt")) }
                          : {}),
                        notes: get(f, "notes"),
                      });
                    }}
                  >
                    <Field label={`Shipment decision notes ${s.reference}`} name="notes" />
                    <Labeled label={`Shipment action ${s.reference}`}>
                      {(id) => (
                        <select required id={id} name="action" className={selectClass}>
                          <option value="">Choose action</option>
                          {s.status === "draft" && d.permissions.approve && (
                            <option value="dispatch.approve">
                              Approve dispatch after contract/payment checks
                            </option>
                          )}
                          {s.status === "approved" && d.permissions.production && (
                            <option value="dispatch.ship">Confirm actual dispatch</option>
                          )}
                          {d.permissions.production && (
                            <option value="dispatch.cancel">Cancel unshipped dispatch</option>
                          )}
                        </select>
                      )}
                    </Labeled>
                    {s.status === "approved" && (
                      <Field
                        label={`Actual dispatch date ${s.reference} (IST)`}
                        name="dispatchedAt"
                        type="datetime-local"
                        required={false}
                      />
                    )}
                    <label className="flex gap-3 text-xs">
                      <input type="checkbox" required />I confirm this shipment action and
                      supporting evidence.
                    </label>
                    <Button disabled={busy}>Save shipment action</Button>
                  </form>
                )}
            </article>
          ))}
        </div>
        {!d.dispatches.length && (
          <p className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
            No shipments yet. Confirm factory readiness on a production load to start.
          </p>
        )}
      </section>
      <section className="space-y-4">
        <h2 className="font-semibold">Delivery confirmations</h2>
        <div className="grid gap-5 xl:grid-cols-2">
          {d.deliveries.map((r) => (
            <article key={r.id} className="min-w-0 space-y-4 rounded-xl border bg-white p-5">
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  {d.dispatches.find((s) => s.id === r.dispatchId)?.reference} · {r.receivedBy}
                </h3>
                <Badge>{r.status}</Badge>
              </div>
              <p className="text-xs">Actual delivery: {dateTime(r.deliveredAt)}</p>
              <p className="whitespace-pre-wrap break-words text-xs">{r.remarks}</p>
              {d.deliveryItems
                .filter((i) => i.deliveryId === r.id)
                .map((i) => (
                  <div key={i.id} className="rounded-lg border p-3 text-xs">
                    <p>
                      Received {i.received} · Damaged {i.damaged} · Missing reported {i.missing}
                    </p>
                    {new Decimal(i.damaged).gt(0) && (
                      <p className="mt-2 font-semibold text-destructive">
                        Damage recorded — installation and engineer review required.
                      </p>
                    )}
                  </div>
                ))}
              {filePanel("delivery", r.id, r.status === "draft" && d.permissions.production)}
              {r.status === "draft" && d.permissions.production && (
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void command({
                      action: get(f, "action"),
                      id: r.id,
                      version: r.version,
                      notes: get(f, "notes"),
                    });
                  }}
                >
                  <Field label={`Delivery confirmation notes ${r.id}`} name="notes" />
                  <Labeled label={`Delivery action ${r.id}`}>
                    {(id) => (
                      <select id={id} name="action" className={selectClass}>
                        <option value="delivery.confirm">
                          Confirm actual quantities and proof
                        </option>
                        <option value="delivery.cancel">Cancel this unconfirmed draft</option>
                      </select>
                    )}
                  </Labeled>
                  <label className="flex gap-3 text-xs">
                    <input required type="checkbox" />I confirm the site quantities and uploaded
                    delivery proof.
                  </label>
                  <Button disabled={busy}>Save delivery decision</Button>
                </form>
              )}
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
