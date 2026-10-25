import type { Database } from "../../src/lib/db";
import type { AuthSettings } from "../../src/lib/auth/config";
import { leadService } from "../../src/lib/leads/service";
import { presalesService } from "../../src/lib/presales/service";

// All fixtures use the same authenticated completion operations as the UI.
export function salesSteps(db: Database, settings: AuthSettings, headers: Headers, id: string) {
  const leads = leadService(db, settings),
    workflow = presalesService(db, settings);
  async function done() {
    const { lead } = await leads.detail(headers, id);
    return workflow.completeStage(headers, id, { version: lead.version, stage: lead.stage });
  }
  return {
    done,
    async throughVisit() {
      await done();
      const { lead } = await leads.detail(headers, id);
      const visit = {
        assignedTo: lead.assignedTo!,
        scheduledAt: new Date().toISOString(),
        status: "scheduled",
      };
      const saved = await workflow.appointment(headers, id, visit);
      await done();
      await workflow.appointment(headers, id, {
        ...visit,
        id: saved.id,
        version: 1,
        status: "completed",
        observations: "Isolated site inspection",
        measurements: [{ label: "Width", value: "1500", unit: "mm" }],
      });
      await done();
    },
    async throughShowroom() {
      await done();
      await workflow.engagement(headers, id, {
        kind: "showroom",
        occurredAt: new Date().toISOString(),
        outcome: "Not Required",
        notRequired: true,
        reason: "Isolated customer presentation completed",
      });
      await done();
      await workflow.engagement(headers, id, {
        kind: "negotiation",
        occurredAt: new Date().toISOString(),
        outcome: "Offer agreed",
        notes: "Isolated commercial confirmation",
      });
    },
  };
}
