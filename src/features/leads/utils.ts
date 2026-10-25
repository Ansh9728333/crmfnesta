import type { LeadInput } from "@/lib/leads/validation";
import type { Directory, LeadRow } from "./types";
export const selectClass = "h-10 w-full rounded-md border bg-white px-3 text-xs";
export function money(value: string | number | null | undefined) {
  return value == null || value === ""
    ? "—"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(Number(value));
}
export function dateTime(value: string | Date | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Not scheduled";
}
export function localInput(value: string | Date | null | undefined) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
  return parts.replace(" ", "T");
}
export function utcInput(value: string) {
  return value
    ? new Date(`${value.length === 16 ? value + ":00" : value}+05:30`).toISOString()
    : "";
}
export function emptyLead(directory: Directory): LeadInput {
  const org = directory.organizations[0]?.id ?? "",
    centre = directory.centres.find((c) => c.organizationId === org)?.id ?? "",
    people = directory.employees.filter((p) => p.centreId === centre),
    assigned = people.find((p) => p.id === directory.currentUserId)?.id ?? people[0]?.id ?? "";
  return {
    organizationId: org,
    centreId: centre,
    assignedTo: assigned,
    clientName: "",
    mobile: "",
    customerId: "",
    projectId: "",
    projectName: "",
    bookingMonth: "",
    financialYear: "",
    brand: "",
    cseId: "",
    siteAddress: "",
    territory: "",
    soe: "",
    customerType: "",
    buildingType: "",
    orderType: "",
    finalisedValue: "",
    orderQty: "",
    pleatedMeshQty: "",
    material: "",
    discountOffered: "",
    source: "",
    priority: "normal",
    expectedValue: "",
    nextFollowUp: "",
    nextAction: "",
    remarks: "",
    stage: 1,
    outcome: "open",
    lossReason: "",
    duplicateAcknowledged: false,
    duplicateReason: "",
  };
}
export function leadInput(lead: LeadRow): LeadInput {
  return {
    organizationId: lead.organizationId,
    centreId: lead.centreId,
    assignedTo: lead.assignedTo ?? "",
    clientName: lead.clientName,
    mobile: lead.mobile,
    customerId: lead.customerId,
    projectId: lead.projectId ?? "",
    projectName: lead.projectName ?? "",
    bookingMonth: lead.bookingMonth ?? "",
    financialYear: lead.financialYear ?? "",
    brand: lead.brand ?? "",
    cseId: lead.cseId ?? "",
    siteAddress: lead.siteAddress ?? "",
    territory: lead.territory ?? "",
    soe: lead.soe ?? "",
    customerType: lead.customerType ?? "",
    buildingType: lead.buildingType ?? "",
    orderType: lead.orderType ?? "",
    finalisedValue: lead.finalisedValue ?? "",
    orderQty: lead.orderQty ?? "",
    pleatedMeshQty: lead.pleatedMeshQty ?? "",
    material: (lead.material ?? "") as LeadInput["material"],
    discountOffered: lead.discountOffered ?? "",
    source: lead.source ?? "",
    priority: lead.priority as LeadInput["priority"],
    expectedValue: lead.expectedValue ?? "",
    nextFollowUp: lead.nextFollowUp ?? "",
    nextAction: lead.nextAction ?? "",
    remarks: lead.remarks ?? "",
    stage: lead.stage,
    outcome: (lead.outcome ?? "open") as LeadInput["outcome"],
    lossReason: lead.lossReason ?? "",
    duplicateAcknowledged: false,
    duplicateReason: "",
  };
}
export class RequestError extends Error {
  constructor(
    message: string,
    public payload: Record<string, unknown> = {},
  ) {
    super(message);
  }
}
export async function requestJson<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok)
    throw new RequestError(result.error ?? "The request could not be completed", result);
  return result;
}
