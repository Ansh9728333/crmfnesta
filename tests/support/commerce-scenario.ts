// Disposable integration fixtures only; uses the same authenticated services as production.
import { expect } from "vitest";
import type { Database } from "../../src/lib/db";
import type { AuthSettings } from "../../src/lib/auth/config";
import { commerceService } from "../../src/lib/commerce/service";
import { productionService } from "../../src/lib/production/service";
import type { FileStore } from "../../src/lib/presales/service";
export async function exerciseCommerce(
  db: Database,
  settings: AuthSettings,
  h: Headers,
  orderId: string,
  store: FileStore,
  fullPayment = false,
  unauthorized?: Headers,
  verifier?: Headers,
) {
  const commerce = commerceService(db, settings),
    production = productionService(db, settings),
    date = "2020-01-01T10:00:00+05:30";
  const command = (body: unknown) => commerce.command(h, orderId, body);
  const attach = (kind: "payment" | "dispatch" | "delivery", id: string) =>
    commerce.upload(
      h,
      orderId,
      kind,
      id,
      {
        name: `${kind}-evidence.png`,
        contentType: "image/png",
        bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      },
      store,
    );
  let detail = await commerce.detail(h, orderId);
  for (const l of detail.loads) {
    let load = await production.detail(h, l.id);
    if (!l.siteReady) {
      await production.change(h, l.id, {
        action: "readiness",
        version: load.load.version,
        siteReady: true,
        notes: "Remaining site confirmed ready",
      });
      load = await production.detail(h, l.id);
    }
    const targets = ["released", "in_production", "factory_ready"];
    while (load.load.status !== "factory_ready") {
      const next = load.load.status === "planned" ? 0 : load.load.status === "released" ? 1 : 2;
      await production.change(h, l.id, {
        action: "advance",
        version: load.load.version,
        target: targets[next],
        occurredAt: date,
        reference: `Actual ${targets[next]}`,
        estimatedAt: "2020-01-02T10:00:00Z",
        notes: "Verified factory operations for material scenario",
      });
      load = await production.detail(h, l.id);
    }
  }
  detail = await commerce.detail(h, orderId);
  const milestones: string[] = [];
  for (const [index, l] of detail.loads.entries()) {
    const m = await command({
      action: "milestone.save",
      version: 0,
      loadId: l.id,
      name: `Dispatch milestone ${index + 1}`,
      amount: index === 0 ? "30" : "10",
      beforeDispatch: true,
      contractReference: "Approved contract",
      notes: "Contract requires cumulative 40 INR and load-specific allocated amounts",
    });
    milestones.push(m.id);
  }
  const shipments: { id: string; loadId: string; quantity: string }[] = [];
  for (const [index, l] of detail.loads.entries()) {
    const item = detail.loadItems.find((i) => i.loadId === l.id)!;
    for (const quantity of index === 0 ? ["20", "10"] : ["10"]) {
      let d = await command({
        action: "dispatch.create",
        loadId: l.id,
        reference: `Dispatch-${l.id}-${quantity}`,
        transporter: "Verified transporter",
        vehicleNumber: "KA01AB1234",
        expectedAt: "2020-01-02T10:00:00+05:30",
        notes: "Item-specific planned consignment",
        items: [{ loadItemId: item.id, quantity }],
      });
      if (index === 0 && quantity === "20") {
        await command({
          action: "dispatch.cancel",
          id: d.id,
          version: 1,
          notes: "Correct an unshipped draft while preserving history",
        });
        d = await command({
          action: "dispatch.create",
          loadId: l.id,
          reference: `Dispatch-${l.id}-20-reissued`,
          transporter: "Verified transporter",
          vehicleNumber: "KA01AB1234",
          expectedAt: "2020-01-02T10:00:00+05:30",
          notes: "Replacement draft after cancellation",
          items: [{ loadItemId: item.id, quantity }],
        });
      }
      await attach("dispatch", d.id);
      shipments.push({ id: d.id, loadId: l.id, quantity });
    }
  }
  const shipment = shipments[0];
  await expect(
    command({
      action: "dispatch.approve",
      id: shipment.id,
      version: 1,
      notes: "Unfunded dispatch attempt",
    }),
  ).rejects.toMatchObject({ status: 409 });
  const amounts = fullPayment ? ["100"] : ["20", "20"],
    receiptIds: string[] = [];
  for (const [index, amount] of amounts.entries()) {
    const p = await command({
      action: "payment.record",
      amount,
      mode: index === 0 ? "bank_transfer" : "upi",
      reference: `Receipt-${orderId}-${index}`,
      receivedAt: date,
      notes: "Actual isolated installment evidence",
    });
    receiptIds.push(p.id);
    await expect(
      command({ action: "payment.verify", id: p.id, version: 1, notes: "No receipt yet" }),
    ).rejects.toMatchObject({ status: 400 });
    if (unauthorized)
      await expect(
        commerce.command(unauthorized, orderId, {
          action: "payment.verify",
          id: p.id,
          version: 1,
          notes: "Unauthorized verification",
        }),
      ).rejects.toMatchObject({ status: 403 });
    await attach("payment", p.id);
    await commerce.command(verifier ?? h, orderId, {
      action: "payment.verify",
      id: p.id,
      version: 1,
      notes: "Accounts checked bank transaction and receipt",
    });
    if (index === 0) {
      await command({
        action: "payment.allocate",
        paymentId: p.id,
        milestoneId: milestones[0],
        amount: fullPayment ? "30" : "20",
        notes: "Allocate verified funds to first load",
      });
      if (!fullPayment)
        await expect(
          command({
            action: "dispatch.approve",
            id: shipment.id,
            version: 1,
            notes: "Partial milestone remains outstanding",
          }),
        ).rejects.toMatchObject({ status: 409 });
    }
  }
  if (fullPayment)
    await command({
      action: "payment.allocate",
      paymentId: receiptIds[0],
      milestoneId: milestones[1],
      amount: "10",
      notes: "Allocate verified funds to second load",
    });
  else {
    await command({
      action: "payment.allocate",
      paymentId: receiptIds[1],
      milestoneId: milestones[0],
      amount: "10",
      notes: "Remaining first-load installment",
    });
    await command({
      action: "payment.allocate",
      paymentId: receiptIds[1],
      milestoneId: milestones[1],
      amount: "10",
      notes: "Second-load installment",
    });
  }
  await expect(
    command({
      action: "payment.record",
      amount: "1",
      mode: "bank_transfer",
      reference: `RECEIPT-${orderId}-0`,
      receivedAt: date,
      notes: "Duplicate reference",
    }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    command({
      action: "payment.record",
      amount: "-1",
      mode: "cash",
      reference: "negative",
      receivedAt: date,
      notes: "Invalid amount",
    }),
  ).rejects.toThrow();
  await expect(
    command({
      action: "payment.allocate",
      paymentId: receiptIds[0],
      milestoneId: milestones[0],
      amount: "1",
      notes: "Duplicate or excess allocation",
    }),
  ).rejects.toMatchObject({ status: 409 });
  detail = await commerce.detail(h, orderId);
  expect(detail.totals.verified).toBe(fullPayment ? "100.00" : "40.00");
  expect(detail.totals.outstanding).toBe(fullPayment ? "0.00" : "60.00");
  for (const [index, d] of shipments.entries()) {
    await command({
      action: "dispatch.approve",
      id: d.id,
      version: 1,
      notes: "Coordinator approved contract, verified allocations and challan",
    });
    await command({
      action: "dispatch.ship",
      id: d.id,
      version: 2,
      dispatchedAt: date,
      notes: "Transporter collected actual shipment",
    });
    if (index === 0)
      expect((await production.detail(h, d.loadId)).load.status).toBe("factory_ready");
    detail = await commerce.detail(h, orderId);
    const item = detail.dispatchItems.find((i) => i.dispatchId === d.id)!;
    await expect(
      command({
        action: "delivery.create",
        dispatchId: d.id,
        deliveredAt: date,
        receivedBy: "Site representative",
        remarks: "Invalid over-receipt",
        items: [
          {
            dispatchItemId: item.id,
            received: String(Number(d.quantity) + 1),
            damaged: "0",
            missing: "0",
          },
        ],
      }),
    ).rejects.toMatchObject({ status: 409 });
    if (index === 0) {
      const cancelled = await command({
        action: "delivery.create",
        dispatchId: d.id,
        deliveredAt: date,
        receivedBy: "Site representative",
        remarks: "Duplicate draft to cancel",
        items: [{ dispatchItemId: item.id, received: "1", damaged: "0", missing: "0" }],
      });
      await command({
        action: "delivery.cancel",
        id: cancelled.id,
        version: 1,
        notes: "Cancel unconfirmed duplicate; no quantities consumed",
      });
    }
    const quantities = fullPayment ? [d.quantity] : [String(Number(d.quantity) - 1), "1"];
    for (const [part, received] of quantities.entries()) {
      const receipt = await command({
        action: "delivery.create",
        dispatchId: d.id,
        deliveredAt: date,
        receivedBy: "Site representative",
        remarks: "Counted at site; observations retained",
        items: [
          {
            dispatchItemId: item.id,
            received,
            damaged: index === 1 && part === 0 ? "1" : "0",
            missing: !fullPayment && part === 0 ? "1" : "0",
          },
        ],
      });
      await expect(
        command({ action: "delivery.confirm", id: receipt.id, version: 1, notes: "Missing proof" }),
      ).rejects.toMatchObject({ status: 400 });
      await attach("delivery", receipt.id);
      await command({
        action: "delivery.confirm",
        id: receipt.id,
        version: 1,
        notes: "Proof and actual quantities checked",
      });
      if (!fullPayment && part === 0) {
        const current = (await commerce.detail(h, orderId)).dispatches.find((s) => s.id === d.id)!;
        expect(current.status).toBe("partially_delivered");
      }
    }
  }
  detail = await commerce.detail(h, orderId);
  expect(
    detail.dispatches
      .filter((s) => s.status !== "cancelled")
      .every((s) => s.status === "delivered"),
  ).toBe(true);
  expect(detail.loads.every((l) => l.status === "delivered")).toBe(true);
  expect(detail.deliveryItems.some((i) => i.damaged === "1.000")).toBe(true);
  return { receiptIds, milestones, shipments };
}
