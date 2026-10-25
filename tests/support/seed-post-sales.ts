import { aftercareService } from "../../src/lib/aftercare/service";
// Disposable browser fixtures only. The Storage transport is injected here;
// production never imports this module or falls back to a test object store.
import { asc } from "drizzle-orm";
import type { Database } from "../../src/lib/db";
import type { AuthSettings } from "../../src/lib/auth/config";
import { buildAuth } from "../../src/lib/auth/config";
import { resolveAccess } from "../../src/lib/auth/access";
import { organizations, centres } from "../../src/lib/db/schema";
import { leadService } from "../../src/lib/leads/service";
import { leadFormSchema } from "../../src/lib/leads/validation";
import { presalesService, type FileStore } from "../../src/lib/presales/service";
import { productionService } from "../../src/lib/production/service";
import { commerceService } from "../../src/lib/commerce/service";
import { stageData } from "./post-sales-data";
import { orderService } from "../../src/lib/orders/service";
export async function seedPostSalesBrowser(db: Database, settings: AuthSettings, headers: Headers) {
  const actor = (await resolveAccess(db, buildAuth(db, settings), headers)).user.id,
    [company] = await db.select().from(organizations).orderBy(asc(organizations.slug)),
    [branch] = (await db.select().from(centres)).filter((c) => c.organizationId === company.id),
    leads = leadService(db, settings),
    presales = presalesService(db, settings),
    orders = orderService(db, settings);
  const objects = new Map<string, Uint8Array>(),
    store: FileStore = {
      async upload(path, bytes) {
        objects.set(path, bytes);
      },
      async remove(path) {
        objects.delete(path);
      },
      async sign() {
        throw new Error("Seed files are not served by production Storage");
      },
    };
  for (const [index, fixture] of [
    "Engine desktop",
    "Engine mobile",
    "Commerce desktop",
    "Commerce mobile",
    "Delivery desktop",
    "Delivery mobile",
    "Installation desktop",
    "Installation mobile",
  ].entries()) {
    const fixtureCompany = fixture.startsWith("Installation")
      ? (await db.select().from(organizations)).find((o) => o.slug === "s-grip")!
      : company;
    const fixtureBranch = fixture.startsWith("Installation")
      ? (await db.select().from(centres)).find((c) => c.organizationId === fixtureCompany.id)!
      : branch;
    const input = leadFormSchema.parse({
        organizationId: fixtureCompany.id,
        centreId: fixtureBranch.id,
        assignedTo: actor,
        clientName: fixture,
        mobile: `987680001${index}`,
        projectName: `${fixture} site`,
        siteAddress: "Isolated post-sales browser fixture address",
      }),
      lead = await leads.create(headers, input);
    for (let stage = 2; stage <= 6; stage++) {
      const detail = await leads.detail(headers, lead.id);
      await leads.update(headers, lead.id, {
        version: detail.lead.version,
        data: {
          ...input,
          customerId: detail.lead.customerId,
          projectId: detail.lead.projectId,
          stage,
        },
      });
    }
    const quote = await presales.quotation(headers, lead.id, {
      expectedRevision: 0,
      items: [
        {
          name: "Workflow fixture product",
          description: "Isolated test item",
          productCompanyId: fixtureCompany.id,
          quantity: "40",
          unitPrice: "2.50",
          discount: "0",
        },
      ],
    });
    await presales.decide(headers, lead.id, {
      quotationId: quote.id,
      decision: "accepted",
      evidence: "Isolated test acceptance",
    });
    const detail = await leads.detail(headers, lead.id),
      order = await presales.convert(headers, lead.id, {
        version: detail.lead.version,
        organizationId: fixtureCompany.id,
        quotationId: quote.id,
        finalValue: "100",
        quantitiesConfirmed: true,
      });
    await orders.upload(
      headers,
      order.id,
      1,
      {
        name: "isolated-group-evidence.png",
        contentType: "image/png",
        bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      },
      store,
    );
    if (!fixture.startsWith("Engine")) {
      const production = productionService(db, settings),
        finance = commerceService(db, settings),
        date = "2020-01-01T10:00:00+05:30";
      const item = (await orders.detail(headers, order.id)).items[0];
      const load = await production.create(headers, {
        orderId: order.id,
        assignedTo: actor,
        siteReady: true,
        notes: "Isolated single-load browser fixture",
        allocations: [{ orderItemId: item.id, quantity: "40" }],
      });
      for (let number = 1; number <= 6; number++) {
        let stage = (await orders.detail(headers, order.id)).stages.find(
          (s) => s.number === number,
        )!;
        await orders.transition(headers, order.id, number, {
          action: "plan",
          version: stage.version,
          assignedTo: actor,
          plannedAt: date,
        });
        stage = (await orders.detail(headers, order.id)).stages.find((s) => s.number === number)!;
        await orders.transition(headers, order.id, number, {
          action: "start",
          version: stage.version,
        });
        if (number !== 1)
          await orders.upload(
            headers,
            order.id,
            number,
            {
              name: "stage-evidence.png",
              contentType: "image/png",
              bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
            },
            store,
          );
        stage = (await orders.detail(headers, order.id)).stages.find((s) => s.number === number)!;
        await orders.transition(headers, order.id, number, {
          action: "submit",
          version: stage.version,
          data: { ...stageData(number), ...(number === 6 ? { loadCount: 1 } : {}) },
          notes: "Isolated stage evidence",
        });
        stage = (await orders.detail(headers, order.id)).stages.find((s) => s.number === number)!;
        await orders.transition(headers, order.id, number, {
          action: "approve",
          version: stage.version,
          reason: "Isolated approval",
        });
      }
      for (const target of ["released", "in_production", "factory_ready"]) {
        const d = await production.detail(headers, load.id);
        await production.change(headers, load.id, {
          action: "advance",
          version: d.load.version,
          target,
          occurredAt: date,
          reference: target,
          estimatedAt: "2020-01-02T10:00:00Z",
          notes: "Isolated factory evidence",
        });
      }
      const milestone = await finance.command(headers, order.id, {
        action: "milestone.save",
        version: 0,
        loadId: load.id,
        name: "Contract dispatch milestone",
        amount: "40",
        beforeDispatch: true,
        contractReference: "Approved contract",
        notes: "Forty INR before dispatch",
      });
      for (let part = 0; part < 2; part++) {
        const p = await finance.command(headers, order.id, {
          action: "payment.record",
          amount: "20",
          mode: "upi",
          reference: fixture + " receipt " + (part + 1),
          receivedAt: date,
          notes: "Isolated actual receipt",
        });
        await finance.upload(
          headers,
          order.id,
          "payment",
          p.id,
          {
            name: "receipt.png",
            contentType: "image/png",
            bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
          },
          store,
        );
        if (fixture.startsWith("Delivery") || fixture.startsWith("Installation")) {
          await finance.command(headers, order.id, {
            action: "payment.verify",
            id: p.id,
            version: 1,
            notes: "Accounts verified",
          });
          await finance.command(headers, order.id, {
            action: "payment.allocate",
            paymentId: p.id,
            milestoneId: milestone.id,
            amount: "20",
            notes: "Fund contractual milestone",
          });
        }
      }
      const line = (await finance.detail(headers, order.id)).loadItems[0];
      const dispatch = await finance.command(headers, order.id, {
        action: "dispatch.create",
        loadId: load.id,
        reference: fixture + " consignment",
        transporter: "Test transporter",
        vehicleNumber: "KA01AB1234",
        expectedAt: "2020-01-02T10:00:00Z",
        notes: "Isolated shipment",
        items: [{ loadItemId: line.id, quantity: "40" }],
      });
      await finance.upload(
        headers,
        order.id,
        "dispatch",
        dispatch.id,
        {
          name: "challan.png",
          contentType: "image/png",
          bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        },
        store,
      );
      if (fixture.startsWith("Delivery") || fixture.startsWith("Installation")) {
        await finance.command(headers, order.id, {
          action: "dispatch.approve",
          id: dispatch.id,
          version: 1,
          notes: "Approved verified funds and challan",
        });
        await finance.command(headers, order.id, {
          action: "dispatch.ship",
          id: dispatch.id,
          version: 2,
          dispatchedAt: date,
          notes: "Material collected",
        });
        const item = (await finance.detail(headers, order.id)).dispatchItems[0];
        const delivery = await finance.command(headers, order.id, {
          action: "delivery.create",
          dispatchId: dispatch.id,
          deliveredAt: date,
          receivedBy: "Site representative",
          remarks: "Thirty received; ten still in transit",
          items: [
            {
              dispatchItemId: item.id,
              received: fixture.startsWith("Installation") ? "40" : "30",
              damaged: "1",
              missing: fixture.startsWith("Installation") ? "0" : "10",
            },
          ],
        });
        await finance.upload(
          headers,
          order.id,
          "delivery",
          delivery.id,
          {
            name: "pod.png",
            contentType: "image/png",
            bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
          },
          store,
        );
        if (fixture.startsWith("Installation")) {
          await finance.command(headers, order.id, {
            action: "delivery.confirm",
            id: delivery.id,
            version: 1,
            notes: "All quantities received at site",
          });
          const api = aftercareService(db, settings),
            result = await api.change(headers, order.id, {
              action: "installation.plan",
              loadId: load.id,
              version: 0,
              assignedTo: actor,
              teamName: "Railing installation team",
              teamMembers: [actor],
              plannedAt: date,
              remarks: "Scheduled site team",
            });
          await api.change(headers, order.id, {
            action: "installation.start",
            id: result.id,
            version: 1,
            occurredAt: date,
            glassRequired: true,
            notes: "Glass required for this railing order",
          });
          for (const kind of ["installation_photo", "glass_template"])
            await api.upload(
              headers,
              order.id,
              kind,
              result.id,
              {
                name: kind + ".png",
                contentType: "image/png",
                bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
              },
              store,
            );
          const audit = await api.change(headers, order.id, {
            action: "audit.plan",
            installationId: result.id,
            version: 0,
            engineerId: actor,
            plannedAt: date,
            notes: "Service engineer assigned",
          });
          await api.upload(
            headers,
            order.id,
            "audit_photo",
            audit.id,
            {
              name: "audit-site.png",
              contentType: "image/png",
              bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
            },
            store,
          );
        }
      }
    }
  }
}
