import { managementService } from "../../src/lib/management/service";
// Isolated database fixtures only. Every record uses the authenticated production service.
import { expect } from "vitest";
import { randomUUID } from "node:crypto";
import type { Database } from "../../src/lib/db";
import type { AuthSettings } from "../../src/lib/auth/config";
import type { FileStore } from "../../src/lib/presales/service";
import { aftercareService } from "../../src/lib/aftercare/service";
import { auditChecks, handoverDocumentKinds } from "../../src/lib/aftercare/validation";
export const actualDate = "2020-01-01T10:00:00+05:30";
export async function exerciseInstallation(
  db: Database,
  settings: AuthSettings,
  h: Headers,
  id: string,
  store: FileStore,
  unauthorized?: Headers,
) {
  const api = aftercareService(db, settings),
    get = () => api.detail(h, id),
    command = (body: unknown) => api.change(h, id, body);
  let d = await get();
  if (unauthorized) {
    await expect(api.detail(unauthorized, id)).rejects.toMatchObject({ status: 403 });
    await expect(
      api.change(unauthorized, id, { action: "handover.prepare", notes: "Unauthorized" }),
    ).rejects.toMatchObject({ status: 403 });
  }
  const attach = (kind: string, target: string) =>
    api.upload(
      h,
      id,
      kind,
      target,
      {
        name: `${kind}.png`,
        contentType: "image/png",
        bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      },
      store,
    );
  for (const [index, l] of d.loads.entries()) {
    const { id: iid } = await command({
      action: "installation.plan",
      loadId: l.id,
      version: d.installations.find((i) => i.loadId === l.id)?.version ?? 0,
      assignedTo: d.currentUserId,
      teamName: "Site team",
      teamMembers: [d.currentUserId],
      plannedAt: actualDate,
      remarks: "Installation scheduled",
    });
    const install = async () => (await get()).installations.find((i) => i.id === iid)!;
    await command({
      action: "installation.start",
      id: iid,
      version: (await install()).version,
      occurredAt: actualDate,
      glassRequired: index === 0,
      notes: "Delivered materials checked",
    });
    await expect(
      command({
        action: "installation.complete",
        id: iid,
        version: (await install()).version,
        occurredAt: actualDate,
        notes: "Missing quantities",
      }),
    ).rejects.toMatchObject({ status: 400 });
    const items = d.items.filter((i) => i.loadId === l.id);
    for (const item of items) {
      const invalid = {
        action: "installation.progress",
        id: iid,
        version: (await install()).version,
        loadItemId: item.id,
        quantity: "999",
        requestId: randomUUID(),
        occurredAt: actualDate,
        notes: "Invalid excess",
      };
      await expect(command(invalid)).rejects.toMatchObject({ status: 400 });
      const progress = { ...invalid, quantity: item.quantity, requestId: randomUUID() };
      await command(progress);
      await expect(command(progress)).resolves.toBeDefined();
      await expect(
        command({
          ...progress,
          requestId: randomUUID(),
          version: (await install()).version,
          quantity: "1",
        }),
      ).rejects.toMatchObject({ status: 400 });
    }
    await attach("installation_photo", iid);
    if (d.order.companySlug === "s-grip") {
      const glass = async () => (await get()).glass.find((g) => g.installationId === iid)!;
      if (index === 0) {
        await expect(
          command({
            action: "installation.complete",
            id: iid,
            version: (await install()).version,
            occurredAt: actualDate,
            notes: "Glass incomplete",
          }),
        ).rejects.toMatchObject({ status: 400 });
        await expect(
          command({
            action: "glass.approve",
            installationId: iid,
            version: (await glass()).version,
            occurredAt: actualDate,
            notes: "No prepared template",
          }),
        ).rejects.toMatchObject({ status: 400 });
        await command({
          action: "glass.measure",
          installationId: iid,
          version: (await glass()).version,
          responsibleId: d.currentUserId,
          occurredAt: actualDate,
          dimensions: [
            { label: "Width", value: "1200", unit: "mm" },
            { label: "Height", value: "900", unit: "mm" },
          ],
          notes: "Measured on site",
        });
        const file = await attach("glass_template", iid);
        await command({
          action: "glass.prepare",
          installationId: iid,
          version: (await glass()).version,
          templateFileId: file.id,
          occurredAt: actualDate,
          notes: "Template prepared from dimensions",
        });
        await command({
          action: "glass.approve",
          installationId: iid,
          version: (await glass()).version,
          occurredAt: actualDate,
          notes: "Template checked and approved",
        });
      } else
        await expect(
          command({
            action: "glass.measure",
            installationId: iid,
            version: (await glass()).version,
            responsibleId: d.currentUserId,
            occurredAt: actualDate,
            dimensions: [{ label: "Width", value: "1", unit: "mm" }],
            notes: "Not required",
          }),
        ).rejects.toMatchObject({ status: 400 });
    }
    await command({
      action: "installation.complete",
      id: iid,
      version: (await install()).version,
      occurredAt: actualDate,
      notes: "All quantities installed and photos recorded",
    });
    const { id: aid } = await command({
        action: "audit.plan",
        installationId: iid,
        version: (await get()).audits.find((a) => a.installationId === iid)?.version ?? 0,
        engineerId: d.currentUserId,
        plannedAt: actualDate,
        notes: "Quality inspection planned",
      }),
      audit = async () => (await get()).audits.find((a) => a.id === aid)!;
    const checklist = auditChecks.map((key) => ({ key, result: "pass", notes: "Checked" }));
    await command({
      action: "audit.inspect",
      id: aid,
      version: (await audit()).version,
      inspectionAt: actualDate,
      checklist: checklist.map((c, n) => ({ ...c, result: n === 0 ? "fail" : "pass" })),
      notes: "Adjustment needed",
    });
    await attach("audit_photo", aid);
    const { id: pid } = await command({
      action: "punch.create",
      auditId: aid,
      description: "Adjust fixing",
      assignedTo: d.currentUserId,
      dueAt: actualDate,
      notes: "Correct before approval",
    });
    await expect(
      command({
        action: "audit.submit",
        id: aid,
        version: (await audit()).version,
        notes: "Unresolved punch item",
      }),
    ).rejects.toMatchObject({ status: 400 });
    const p = (await get()).punches.find((p) => p.id === pid)!;
    await command({
      action: "punch.resolve",
      id: pid,
      version: p.version,
      occurredAt: actualDate,
      notes: "Fixing corrected and rechecked",
    });
    await command({
      action: "audit.inspect",
      id: aid,
      version: (await audit()).version,
      inspectionAt: actualDate,
      checklist,
      notes: "Corrected work passed inspection",
    });
    await command({
      action: "audit.submit",
      id: aid,
      version: (await audit()).version,
      notes: "Ready for approval",
    });
    await command({
      action: "audit.changes",
      id: aid,
      version: (await audit()).version,
      notes: "Confirm inspection evidence",
    });
    await command({
      action: "audit.submit",
      id: aid,
      version: (await audit()).version,
      notes: "Evidence confirmed",
    });
    await command({
      action: "audit.approve",
      id: aid,
      version: (await audit()).version,
      notes: "Final quality approval",
    });
    d = await get();
    const load = d.loads.find((x) => x.id === l.id)!;
    await command({
      action: "load.complete",
      loadId: l.id,
      version: load.version,
      occurredAt: actualDate,
      notes: "Load fulfillment complete",
    });
    expect((await get()).order.completedAt).toBeNull();
  }
  d = await get();
  expect(
    (
      await managementService(db, settings).report(h, "production", {
        organizationId: d.order.organizationId,
        status: "completed",
      })
    ).total,
  ).toBe(d.loads.length);
  expect(d.installations.every((i) => i.status === "completed")).toBe(true);
  expect(d.audits.every((a) => a.approvedBy)).toBe(true);
  expect(d.items.every((i) => i.quantity === i.installedQuantity)).toBe(true);
  const { id: hid } = await command({
    action: "handover.prepare",
    notes: "Prepare mandatory customer handover pack",
  });
  await expect(
    command({
      action: "handover.confirm",
      id: hid,
      version: 1,
      occurredAt: actualDate,
      customerAccepted: true,
      customerRepresentative: "Customer",
      acceptanceReference: "Signed site acceptance",
      notes: "Premature handover",
    }),
  ).rejects.toMatchObject({ status: 400 });
  for (const kind of handoverDocumentKinds) await attach(kind, hid);
  return { handoverId: hid };
}
export async function exerciseHandover(
  db: Database,
  settings: AuthSettings,
  h: Headers,
  id: string,
) {
  const api = aftercareService(db, settings),
    d = await api.detail(h, id);
  await api.change(h, id, {
    action: "handover.confirm",
    id: d.handover!.id,
    version: d.handover!.version,
    occurredAt: actualDate,
    customerAccepted: true,
    customerRepresentative: "Customer representative",
    acceptanceReference: "Signed acceptance on file",
    notes: "All load and quality checks complete",
  });
  await api.change(h, id, {
    action: "feedback.save",
    version: 0,
    googleRequestedAt: actualDate,
    status: "declined",
    comments: "Customer declined public review; no positive review required",
    publicationConsent: false,
  });
  const { id: tid } = await api.change(h, id, {
    action: "ticket.create",
    title: "Site adjustment request",
    description: "Customer reports adjustment needed",
    kind: "complaint",
    assignedTo: d.currentUserId,
    priority: "high",
    dueAt: actualDate,
    notes: "Complaint recorded",
  });
  const ticket = async () => (await api.detail(h, id)).tickets.find((t) => t.id === tid)!;
  await expect(
    api.change(h, id, {
      action: "ticket.status",
      id: tid,
      version: (await ticket()).version,
      status: "closed",
      notes: "Cannot skip resolution",
    }),
  ).rejects.toMatchObject({ status: 400 });
  for (const status of [
    "in_progress",
    "waiting_customer",
    "resolved",
    "closed",
    "open",
    "in_progress",
    "resolved",
    "closed",
  ])
    await api.change(h, id, {
      action: "ticket.status",
      id: tid,
      version: (await ticket()).version,
      status,
      notes:
        status === "resolved"
          ? "Adjustment completed; customer informed"
          : "Recorded customer service follow-up",
    });
  expect((await ticket()).resolution).toContain("Adjustment completed");
  expect((await api.detail(h, id)).feedback?.status).toBe("declined");
}
