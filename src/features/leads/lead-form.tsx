"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { preSalesStages } from "@/lib/domain/workflows";
import { leadFormSchema, type LeadInput } from "@/lib/leads/validation";
import type { CustomerList, Directory, LeadRow, ProjectList } from "./types";
import {
  emptyLead,
  leadInput,
  localInput,
  RequestError,
  requestJson,
  selectClass,
  utcInput,
} from "./utils";

export function LeadForm({
  directory,
  lead,
  onSaved,
}: {
  directory: Directory;
  lead?: LeadRow;
  onSaved: (id: string) => void | Promise<void>;
}) {
  const [data, setData] = useState<LeadInput>(() =>
    lead ? leadInput(lead) : emptyLead(directory),
  );
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [duplicate, setDuplicate] = useState<{
    candidates: { id: string; clientName: string | null; stage: number }[];
    restricted: boolean;
  } | null>(null);
  const [linkCustomer, setLinkCustomer] = useState(false),
    [customerQuery, setCustomerQuery] = useState(""),
    [customerPage, setCustomerPage] = useState(1),
    [customerResult, setCustomerResult] = useState<CustomerList | null>(null),
    [projectResult, setProjectResult] = useState<ProjectList | null>(null);
  const [projectQuery, setProjectQuery] = useState("");
  const set = <K extends keyof LeadInput>(key: K, value: LeadInput[K]) =>
    setData((prev) => ({
      ...prev,
      [key]: value,
      duplicateAcknowledged:
        key === "duplicateReason" || key === "duplicateAcknowledged"
          ? prev.duplicateAcknowledged
          : false,
    }));
  const branches = directory.centres.filter((c) => c.organizationId === data.organizationId);
  const people = [
    ...new Map(
      directory.employees
        .filter(
          (p) =>
            p.organizationId === data.organizationId &&
            p.centreId === data.centreId &&
            (directory.coordinatorCentres.includes(data.centreId) ||
              p.id === directory.currentUserId),
        )
        .map((p) => [p.id, p]),
    ).values(),
  ];
  const csePeople = directory.employees.filter(
    (p) =>
      p.role === "CSE" && p.organizationId === data.organizationId && p.centreId === data.centreId,
  );
  const canAssign = !lead || directory.coordinatorCentres.includes(lead.centreId);
  useEffect(() => {
    if (!data.customerId || lead) return;
    let live = true;
    requestJson<ProjectList>(
      `/api/projects?organizationId=${data.organizationId}&customerId=${data.customerId}&pageSize=20`,
    )
      .then((result) => {
        if (live) setProjectResult(result);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [data.customerId, data.organizationId, lead]);
  async function findCustomers(page = 1) {
    try {
      setCustomerResult(
        await requestJson<CustomerList>(
          `/api/customers?organizationId=${data.organizationId}&q=${encodeURIComponent(customerQuery)}&page=${page}&pageSize=20`,
        ),
      );
      setCustomerPage(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Customer lookup failed");
    }
  }
  async function findProjects(page = 1) {
    try {
      setProjectResult(
        await requestJson<ProjectList>(
          `/api/projects?organizationId=${data.organizationId}&customerId=${data.customerId}&pageSize=20&page=${page}&q=${encodeURIComponent(projectQuery)}`,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Project lookup failed");
    }
  }
  const field = (name: keyof LeadInput, label: string, type = "text", required = false) => (
    <div key={name}>
      <label htmlFor={`lead-${name}`} className="text-xs font-medium">
        {label}
        {required && " *"}
      </label>
      <Input
        id={`lead-${name}`}
        className="mt-2 bg-white"
        type={type}
        required={required}
        disabled={name === "projectName" && !!data.projectId}
        value={String(data[name] ?? "")}
        onChange={(e) => set(name, e.target.value as never)}
        maxLength={name === "mobile" ? 25 : 200}
        inputMode={type === "number" ? "decimal" : undefined}
        step={type === "number" ? "any" : undefined}
        min={type === "number" ? 0 : undefined}
      />
      {fieldErrors[name] && <p className="mt-1 text-xs text-destructive">{fieldErrors[name]}</p>}
    </div>
  );
  async function save(acknowledged = false) {
    setError("");
    setFieldErrors({});
    const parsed = leadFormSchema.safeParse({ ...data, duplicateAcknowledged: acknowledged });
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[String(issue.path[0])] = issue.message;
      setFieldErrors(fields);
      setError(parsed.error.issues.map((i) => i.message).join(" · "));
      return;
    }
    setPending(true);
    try {
      const result = await requestJson<{ id: string }>(
        lead ? `/api/leads/${lead.id}` : "/api/leads",
        lead ? "PATCH" : "POST",
        lead ? { data: parsed.data, version: lead.version } : parsed.data,
      );
      await onSaved(result.id);
    } catch (e) {
      if (e instanceof RequestError && e.payload.code === "POSSIBLE_DUPLICATE") {
        setDuplicate({
          candidates: e.payload.candidates as {
            id: string;
            clientName: string | null;
            stage: number;
          }[],
          restricted: Boolean(e.payload.restricted),
        });
      }
      setError(e instanceof Error ? e.message : "Unable to save lead");
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      className="space-y-7"
      onSubmit={(e) => {
        e.preventDefault();
        void save(false);
      }}
    >
      <p className="text-xs leading-6 text-muted-foreground">
        Fields marked * are required. Amounts are in INR. Dates and times use India Standard Time.
      </p>
      <fieldset className="space-y-4">
        <legend className="mb-4 text-sm font-semibold text-primary">01 · Customer & project</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="lead-company" className="text-xs font-medium">
              Company *
            </label>
            <select
              id="lead-company"
              disabled={!!lead}
              className={`${selectClass} mt-2`}
              value={data.organizationId}
              onChange={(e) => {
                const branch = directory.centres.find((c) => c.organizationId === e.target.value);
                const person =
                  directory.employees.find(
                    (p) => p.centreId === branch?.id && p.id === directory.currentUserId,
                  ) ?? directory.employees.find((p) => p.centreId === branch?.id);
                setData((prev) => ({
                  ...prev,
                  organizationId: e.target.value,
                  centreId: branch?.id ?? "",
                  assignedTo: person?.id ?? "",
                  cseId: "",
                  customerId: "",
                  projectId: "",
                }));
                setCustomerResult(null);
                setProjectResult(null);
              }}
            >
              {directory.organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="lead-centre" className="text-xs font-medium">
              Centre / Branch *
            </label>
            <select
              id="lead-centre"
              disabled={!canAssign}
              className={`${selectClass} mt-2`}
              value={data.centreId}
              onChange={(e) => {
                const person =
                  directory.employees.find(
                    (p) => p.centreId === e.target.value && p.id === directory.currentUserId,
                  ) ?? directory.employees.find((p) => p.centreId === e.target.value);
                setData((prev) => ({
                  ...prev,
                  centreId: e.target.value,
                  assignedTo: person?.id ?? "",
                  cseId: "",
                }));
              }}
            >
              {branches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {!lead && (
          <div className="rounded-xl border bg-background p-4">
            <label className="flex items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={linkCustomer}
                onChange={(e) => {
                  setLinkCustomer(e.target.checked);
                  if (!e.target.checked)
                    setData((prev) => ({ ...prev, customerId: "", projectId: "" }));
                }}
              />{" "}
              Link an existing customer
            </label>
            {linkCustomer && (
              <div className="mt-4 space-y-3">
                <div className="flex gap-2">
                  <Input
                    aria-label="Find existing customer"
                    placeholder="Name or mobile number"
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                  />
                  <Button type="button" variant="outline" onClick={() => void findCustomers()}>
                    Find customers
                  </Button>
                </div>
                <select
                  aria-label="Existing customer"
                  className={selectClass}
                  value={data.customerId}
                  onChange={(e) => {
                    const customer = customerResult?.rows.find((c) => c.id === e.target.value);
                    setData((prev) => ({
                      ...prev,
                      customerId: e.target.value,
                      projectId: "",
                      clientName: customer?.name ?? prev.clientName,
                      mobile: customer?.mobile ?? prev.mobile,
                    }));
                  }}
                >
                  <option value="">Select a customer</option>
                  {customerResult?.rows.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.mobile}
                    </option>
                  ))}
                </select>
                {customerResult && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{customerResult.total} matching customers</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        type="button"
                        variant="ghost"
                        disabled={customerPage <= 1}
                        onClick={() => void findCustomers(customerPage - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        size="sm"
                        type="button"
                        variant="ghost"
                        disabled={customerPage * 20 >= customerResult.total}
                        onClick={() => void findCustomers(customerPage + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
                {data.customerId && (
                  <div>
                    <label className="text-xs font-medium" htmlFor="lead-existing-project">
                      Project
                    </label>
                    <select
                      id="lead-existing-project"
                      className={`${selectClass} mt-2`}
                      value={data.projectId}
                      onChange={(e) => {
                        const project = projectResult?.rows.find((p) => p.id === e.target.value);
                        setData((prev) => ({
                          ...prev,
                          projectId: e.target.value,
                          projectName: project?.name ?? "",
                          siteAddress: project?.siteAddress ?? prev.siteAddress,
                        }));
                      }}
                    >
                      <option value="">Create a new project for this customer</option>
                      {data.projectId &&
                        !projectResult?.rows.some((p) => p.id === data.projectId) && (
                          <option value={data.projectId}>{data.projectName}</option>
                        )}
                      {projectResult?.rows.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <div className="mt-3 flex gap-2">
                      <Input
                        aria-label="Find existing project"
                        placeholder="Search this customer's projects"
                        value={projectQuery}
                        onChange={(e) => setProjectQuery(e.target.value)}
                      />
                      <Button type="button" variant="outline" onClick={() => void findProjects()}>
                        Find projects
                      </Button>
                    </div>
                    {projectResult && (
                      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{projectResult.total} projects found</span>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={projectResult.page <= 1}
                            onClick={() => void findProjects(projectResult.page - 1)}
                          >
                            Previous
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={projectResult.page * 20 >= projectResult.total}
                            onClick={() => void findProjects(projectResult.page + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      One customer can have multiple projects. Search all projects on the Projects
                      page.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {field("clientName", "Client name", "text", true)}
          {field("mobile", "Mobile no.", "tel", true)}
          {field("projectName", lead ? "Linked project" : "Project name", "text", !data.projectId)}
          {field("brand", "Brand")}
        </div>
        <div>
          <label htmlFor="lead-address" className="text-xs font-medium">
            Site address *
          </label>
          <textarea
            id="lead-address"
            required
            minLength={5}
            maxLength={1000}
            className="mt-2 min-h-20 w-full rounded-md border bg-white p-3 text-sm"
            value={data.siteAddress}
            onChange={(e) => set("siteAddress", e.target.value)}
          />
        </div>
        {lead && (
          <p className="text-[10px] leading-5 text-muted-foreground">
            Customer and project links stay fixed. Contact and site edits are recorded on this lead,
            preserving the shared parent records.
          </p>
        )}
      </fieldset>
      <fieldset>
        <legend className="mb-4 text-sm font-semibold text-primary">
          02 · Ownership & enquiry
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="lead-assignee" className="text-xs font-medium">
              Assigned executive *
            </label>
            <select
              id="lead-assignee"
              className={`${selectClass} mt-2`}
              required
              disabled={!canAssign}
              value={data.assignedTo}
              onChange={(e) => set("assignedTo", e.target.value)}
            >
              <option value="" disabled>
                Select employee
              </option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="lead-cse" className="text-xs font-medium">
              CSE name
            </label>
            <select
              id="lead-cse"
              className={`${selectClass} mt-2`}
              value={data.cseId}
              onChange={(e) => set("cseId", e.target.value)}
            >
              <option value="">Not assigned</option>
              {csePeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {directory.territories.some((t) => t.organizationId === data.organizationId) ? (
            <div>
              <label htmlFor="lead-territory" className="text-xs font-medium">
                Territory
              </label>
              <select
                id="lead-territory"
                className={selectClass}
                value={data.territory}
                onChange={(e) => set("territory", e.target.value)}
              >
                <option value="">Not specified</option>
                {data.territory &&
                  !directory.territories.some(
                    (t) => t.organizationId === data.organizationId && t.name === data.territory,
                  ) && <option>{data.territory}</option>}
                {directory.territories
                  .filter((t) => t.organizationId === data.organizationId)
                  .map((t) => (
                    <option key={t.id}>{t.name}</option>
                  ))}
              </select>
            </div>
          ) : (
            field("territory", "Territory")
          )}
          {field("soe", "SOE")}
          {field("source", "Lead source")}
          {field("customerType", "Customer type")}
          {field("buildingType", "Building type")}
          {field("orderType", "Order type")}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-4 text-sm font-semibold text-primary">03 · Commercial details</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="lead-month" className="text-xs font-medium">
              Booking month
            </label>
            <select
              id="lead-month"
              className={`${selectClass} mt-2`}
              value={data.bookingMonth ?? ""}
              onChange={(e) => set("bookingMonth", e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Not specified</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option value={i + 1} key={i}>
                  {new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(
                    new Date(Date.UTC(2020, i, 1)),
                  )}
                </option>
              ))}
            </select>
          </div>
          {field("financialYear", "Financial year (e.g. 2026-27)")}
          {field("expectedValue", "Expected value (INR)", "number")}
          {field("finalisedValue", "Order finalised value (optional until Won)", "number")}
          {field("orderQty", "Order qty", "number")}
          {field("pleatedMeshQty", "Pleated mesh qty", "number")}
          <div>
            <label htmlFor="lead-material" className="text-xs font-medium">
              uPVC / Aluminium
            </label>
            <select
              id="lead-material"
              className={`${selectClass} mt-2`}
              value={data.material}
              onChange={(e) => set("material", e.target.value as LeadInput["material"])}
            >
              <option value="">Not applicable / unspecified</option>
              <option>uPVC</option>
              <option>Aluminium</option>
            </select>
          </div>
          {field("discountOffered", "Discount offered (include % or amount)")}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-4 text-sm font-semibold text-primary">
          04 · Progress & next steps
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="lead-stage" className="text-xs font-medium">
              Pre-sales stage
            </label>
            <select id="lead-stage" className={`${selectClass} mt-2`} disabled value={data.stage}>
              {preSalesStages.map((stage, i) => (
                <option key={stage} value={i + 1} disabled={!!lead && i + 1 > lead.stage + 1}>
                  {i + 1}. {stage}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-muted-foreground">
              Use Done on the current step to advance automatically. Won / Lost is recorded in Order
              conversion.
            </p>
          </div>
          <div>
            <label htmlFor="lead-outcome" className="text-xs font-medium">
              Status
            </label>
            <select
              id="lead-outcome"
              className={`${selectClass} mt-2`}
              disabled
              value={data.outcome}
            >
              <option value="open">Open</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </div>
          <div>
            <label htmlFor="lead-priority" className="text-xs font-medium">
              Priority
            </label>
            <select
              id="lead-priority"
              className={`${selectClass} mt-2`}
              value={data.priority}
              onChange={(e) => set("priority", e.target.value as LeadInput["priority"])}
            >
              {["low", "normal", "high", "urgent"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="lead-follow-date" className="text-xs font-medium">
              Next follow-up (IST)
            </label>
            <Input
              id="lead-follow-date"
              className="mt-2"
              type="datetime-local"
              disabled={!!lead?.outcome}
              value={localInput(data.nextFollowUp)}
              onChange={(e) => set("nextFollowUp", utcInput(e.target.value))}
            />
          </div>
          {field("nextAction", "Next action")}
        </div>
        {data.outcome === "lost" && (
          <div className="mt-4">
            <label htmlFor="lead-loss-reason" className="text-xs font-medium">
              Lost reason *
            </label>
            <textarea
              id="lead-loss-reason"
              className="mt-2 min-h-20 w-full rounded-md border p-3 text-sm"
              required
              minLength={3}
              maxLength={1000}
              value={data.lossReason}
              onChange={(e) => set("lossReason", e.target.value)}
            />
          </div>
        )}
        <div className="mt-4">
          <label htmlFor="lead-remarks" className="text-xs font-medium">
            Remarks
          </label>
          <textarea
            id="lead-remarks"
            className="mt-2 min-h-24 w-full rounded-md border bg-white p-3 text-sm"
            maxLength={4000}
            value={data.remarks}
            onChange={(e) => set("remarks", e.target.value)}
          />
        </div>
      </fieldset>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-white p-4 text-xs leading-6 text-destructive"
        >
          {error}
        </p>
      )}
      {duplicate && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold">Possible duplicate leads</h3>
          <ul className="mt-3 space-y-2 text-xs">
            {duplicate.candidates.map((c) => (
              <li key={c.id}>
                <a href={`/leads/${c.id}`} target="_blank" rel="noreferrer" className="underline">
                  {c.clientName ?? "Existing lead"}
                </a>{" "}
                · {preSalesStages[c.stage - 1]}
              </li>
            ))}
          </ul>
          {duplicate.restricted && (
            <p className="mt-3 text-xs">
              A matching record also requires coordinator review. Restricted contact details are not
              shown.
            </p>
          )}
          <label htmlFor="duplicate-reason" className="mt-4 block text-xs font-medium">
            Why is a separate lead needed?
          </label>
          <Input
            id="duplicate-reason"
            className="mt-2 bg-white"
            value={data.duplicateReason}
            onChange={(e) => set("duplicateReason", e.target.value)}
            maxLength={500}
          />
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            disabled={pending || data.duplicateReason.trim().length < 3}
            onClick={() => void save(true)}
          >
            Confirm separate lead
          </Button>
        </section>
      )}
      <div className="sticky bottom-0 -mx-1 border-t bg-white px-1 py-4">
        <Button className="w-full" disabled={pending} type="submit">
          {pending ? "Saving…" : lead ? "Save lead changes" : "Create lead"}
        </Button>
      </div>
    </form>
  );
}
