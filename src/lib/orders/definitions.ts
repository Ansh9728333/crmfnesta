import type { Permission, Role } from "../auth/roles";
import { postSalesStages } from "../domain/workflows";
export type StageField = {
  key: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "url"
    | "datetime"
    | "amount"
    | "integer"
    | "boolean"
    | "measurements"
    | "select";
  required?: boolean;
  options?: string[];
  glassOnly?: boolean;
};
const f = (
  key: string,
  label: string,
  type: StageField["type"] = "text",
  required = true,
): StageField => ({ key, label, type, required });
const fields: StageField[][] = [
  [
    f("groupName", "WhatsApp group name"),
    f("groupLink", "WhatsApp invitation link", "url"),
    f("groupCreatedAt", "Group creation date (IST)", "datetime"),
  ],
  [
    f("contractReference", "Contract reference"),
    f("paymentTerms", "Contract payment / credit terms", "textarea"),
    f("dueBeforeDispatch", "Contractually due by dispatch, cumulative (INR)", "amount"),
  ],
  [f("surveyAt", "Final survey appointment (IST)", "datetime"), f("contactPerson", "Site contact")],
  [
    f("measurements", "Final survey measurements", "measurements"),
    f("surveyFindings", "Survey findings", "textarea"),
  ],
  [
    f("siteReady", "Site readiness checks passed", "boolean"),
    f("readinessChecks", "Readiness evidence / checks", "textarea"),
  ],
  [
    f("loadCount", "Number of production loads", "integer"),
    f("loadPlan", "Production load plan / allocation reference", "textarea"),
  ],
  [
    f("releaseReference", "Production release reference"),
    f("releasedAt", "Release date (IST)", "datetime"),
  ],
  [
    f("factoryReady", "All planned loads factory-ready", "boolean"),
    f("factoryReference", "Factory readiness reference"),
  ],
  [
    f("verifiedReceipts", "Verified cumulative customer receipts (INR)", "amount"),
    f("receiptReferences", "Receipt / bank verification references", "textarea"),
    f("verifiedAt", "Receipt verification date (IST)", "datetime"),
  ],
  [
    f("dispatchReference", "Dispatch / transport reference"),
    f("carrier", "Carrier / vehicle"),
    f("dispatchedAt", "Dispatch date (IST)", "datetime"),
  ],
  [
    f("deliveryReference", "Delivery receipt reference"),
    f("receivedBy", "Received by"),
    f("deliveredAt", "Delivery date (IST)", "datetime"),
  ],
  [
    f("installationStartedAt", "Installation start date (IST)", "datetime"),
    { ...f("glassRequired", "Glass Required (S-Grip)", "boolean"), glassOnly: true },
  ],
  [
    f("allLoadsInstalled", "Installation checks passed for all loads", "boolean"),
    f("installationChecks", "Installation completion checks", "textarea"),
    f("installationCompletedAt", "Installation completion date (IST)", "datetime"),
    ...(
      [
        ["glassMeasurementTaken", "Glass Measurement Taken"],
        ["glassTemplatePrepared", "Glass Template Prepared"],
        ["glassTemplateApproved", "Glass Template Approved"],
      ] as const
    ).map(([key, label]) => ({ ...f(key, label, "boolean", false), glassOnly: true })),
  ],
  [
    f("auditPassed", "Service engineer audit passed", "boolean"),
    f("auditFindings", "Audit checks and findings", "textarea"),
    f("auditAt", "Audit date (IST)", "datetime"),
  ],
  [
    f("handoverAccepted", "Handover checks / customer acceptance recorded", "boolean"),
    f("handoverAt", "Site handover date (IST)", "datetime"),
    f("customerRepresentative", "Customer representative"),
  ],
  [
    f("reviewRequestedAt", "Review request date (IST)", "datetime"),
    {
      ...f("reviewOutcome", "Review request outcome", "select"),
      options: ["requested", "declined", "no_response", "received"],
    },
    f("testimonial", "Customer testimonial (optional)", "textarea", false),
    f("reviewUrl", "Review URL (optional)", "url", false),
  ],
];
const owners: Role[] = [
  "Post-Sales Coordinator",
  "Post-Sales Coordinator",
  "Survey Engineer",
  "Survey Engineer",
  "Post-Sales Coordinator",
  "Production Coordinator",
  "Production Coordinator",
  "Production Coordinator",
  "Accounts",
  "Production Coordinator",
  "Production Coordinator",
  "Installation Team",
  "Installation Team",
  "Service Engineer",
  "Post-Sales Coordinator",
  "Post-Sales Coordinator",
];
const approvers: Role[] = [
  "Sales Manager",
  "Sales Manager",
  "Sales Manager",
  "Sales Manager",
  "Sales Manager",
  "Production Coordinator",
  "Production Coordinator",
  "Production Coordinator",
  "Accounts",
  "Post-Sales Coordinator",
  "Post-Sales Coordinator",
  "Post-Sales Coordinator",
  "Post-Sales Coordinator",
  "Service Engineer",
  "Post-Sales Coordinator",
  "Post-Sales Coordinator",
];
const permissions: Permission[] = [
  "orders.manage",
  "orders.manage",
  "surveys.manage",
  "surveys.manage",
  "orders.manage",
  "production.manage",
  "production.manage",
  "production.manage",
  "payments.manage",
  "production.manage",
  "production.manage",
  "installations.manage",
  "installations.manage",
  "audits.manage",
  "orders.manage",
  "orders.manage",
];
export const stageDefinitions = postSalesStages.map((name, i) => ({
  number: i + 1,
  name,
  ownerRole: owners[i],
  approverRole: approvers[i],
  permission: permissions[i],
  approvalPermission: (i === 8
    ? "payments.manage"
    : i === 6
      ? "production.manage"
      : i === 13
        ? "audits.manage"
        : "orders.read") as Permission,
  fields: fields[i],
  requiredFields: [
    "notes",
    ...fields[i].filter((f) => f.required).map((f) => f.key),
    ...([1, 2, 4, 9, 14, 15].includes(i + 1) ? ["attachments"] : []),
  ],
}));
export function stageDefinition(number: number) {
  const result = stageDefinitions[number - 1];
  if (!result) throw new Error("Invalid post-sales stage");
  return result;
}
