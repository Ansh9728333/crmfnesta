"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Form, get } from "@/features/commerce/shared";
import { Select } from "@/features/aftercare/shared";
import { requestJson, selectClass, dateTime } from "@/features/leads/utils";
import { postSalesStages } from "@/lib/domain/workflows";
import type { SettingsData } from "./types";
const labels = {
  company_profile: "Companies",
  territory: "Territories",
  product_category: "Product categories",
  payment_template: "Payment milestone settings",
  document_requirement: "Document requirements",
  sla: "SLA and delay settings",
};
type Kind = keyof typeof labels;
export function AdminSettings({ data: d }: { data: SettingsData }) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [pending, startTransition] = useTransition(),
    [error, setError] = useState(""),
    [edit, setEdit] = useState<SettingsData["rows"][number] | null>(null),
    kind = d.filters.kind as Kind;
  const query = (page: number) =>
    `/settings?${new URLSearchParams({ ...d.filters, page: String(page) })}`;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Administration
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Admin Panel</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Manage your companies and operational rules. Every saved change is permission-checked and
          audited.
        </p>
      </header>
      <nav className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Employees", "/admin/employees"],
          ["Roles and permissions", "/admin/employees?panel=permissions"],
          ["Workflow stage settings", "/orders/settings"],
          ["Order payment milestones", "/payments"],
        ].map(([name, path]) => (
          <Link
            key={path}
            href={path}
            className="rounded-xl border bg-white p-4 text-sm font-medium hover:border-primary"
          >
            {name} →
          </Link>
        ))}
      </nav>
      <form className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
        <select
          name="organizationId"
          aria-label="Settings company"
          defaultValue={d.filters.organizationId}
          className={`${selectClass} sm:w-64`}
        >
          <option value="">All administered companies</option>
          {d.companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          name="kind"
          aria-label="Settings category"
          defaultValue={kind}
          className={`${selectClass} sm:w-64`}
        >
          {Object.entries(labels).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <Button>View settings</Button>
      </form>
      <section className="rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold">{labels[kind]}</h2>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          {kind === "company_profile"
            ? "The three company identities are fixed. Manage legal/contact details and availability for new leads; ongoing orders remain available."
            : kind === "payment_template"
              ? "Templates prefill explicit order milestones as a percentage of order value. Admin must review the amount, contract reference and load before saving."
              : kind === "document_requirement"
                ? "Add mandatory named attachments to a shared workflow stage. New orders snapshot active requirements; existing orders retain their rules. Snapshots are checked on submission, approval and stage 15 handover. Core documents and checks cannot be removed."
                : kind === "sla"
                  ? "Grace hours apply after recorded due dates. Missing targets are not treated as known delays. Changes affect current delay reports and alerts."
                  : "Create or edit company-owned records. Disable records to preserve historical references."}
        </p>
      </section>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section className="space-y-3">
          {d.rows.map((row) => (
            <article key={row.id} className="space-y-3 rounded-xl border bg-white p-5">
              <div className="flex justify-between gap-3">
                <h3 className="font-semibold">{row.name}</h3>
                <span className="text-xs">{row.active ? "Active" : "Disabled"}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {d.companies.find((c) => c.id === row.organizationId)?.name} · Version {row.version}{" "}
                · {dateTime(row.updatedAt)}
              </p>
              <dl className="space-y-1 text-xs">
                {Object.entries(row.config).map(([key, value]) => (
                  <div key={key} className="flex flex-wrap gap-2">
                    <dt className="font-medium">
                      {(
                        {
                          legalName: "Legal name",
                          address: "Address",
                          email: "Email",
                          phone: "Phone",
                          gstin: "GSTIN",
                          description: "Description",
                          unit: "Unit",
                          percentage: "Percentage",
                          beforeDispatch: "Before dispatch",
                          offsetDays: "Due after days",
                          stageNumber: "Workflow stage",
                          target: "Delay target",
                          graceHours: "Grace hours",
                        } as Record<string, string>
                      )[key] ?? key}
                      :
                    </dt>
                    <dd className="break-all">
                      {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? "")}
                    </dd>
                  </div>
                ))}
              </dl>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEdit(row);
                  setError("");
                }}
              >
                Edit setting
              </Button>
            </article>
          ))}
          {!d.rows.length && (
            <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
              No settings in this category. Existing core workflows remain in effect.
            </div>
          )}
          <nav aria-label="Settings pagination" className="flex justify-between text-xs">
            {d.filters.page > 1 ? <Link href={query(d.filters.page - 1)}>Previous</Link> : <span />}
            <span>
              {d.total} settings · Page {d.filters.page}
            </span>
            {d.filters.page * 20 < d.total ? (
              <Link href={query(d.filters.page + 1)}>Next</Link>
            ) : (
              <span />
            )}
          </nav>
        </section>
        <SettingForm
          key={`${kind}-${edit?.id ?? "new"}-${edit?.version ?? 0}`}
          kind={kind}
          edit={edit}
          d={d}
          busy={busy || pending}
          cancel={() => setEdit(null)}
          save={async (body) => {
            setBusy(true);
            setError("");
            try {
              await requestJson("/api/admin/settings", "POST", body);
              window.dispatchEvent(new Event("siteflow-notifications-updated"));
              setEdit(null);
              startTransition(() => router.refresh());
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
    </div>
  );
}
function SettingForm({
  kind,
  edit,
  d,
  busy,
  save,
  cancel,
}: {
  kind: Kind;
  edit: SettingsData["rows"][number] | null;
  d: SettingsData;
  busy: boolean;
  save: (body: unknown) => Promise<void>;
  cancel: () => void;
}) {
  const [company, setCompany] = useState(
      edit?.organizationId ?? d.filters.organizationId ?? d.companies[0]?.id ?? "",
    ),
    org = d.companies.find((c) => c.id === company),
    c = edit?.config ?? {},
    value = (key: string, defaultValue = "") => String(c[key] ?? defaultValue);
  return (
    <Form
      title={edit ? `Edit ${edit.name}` : `Add ${labels[kind]}`}
      submit="Save setting"
      busy={busy}
      onSubmit={(f) => {
        const name = kind === "company_profile" ? (org?.name ?? "") : get(f, "name"),
          code =
            edit?.code ??
            (kind === "company_profile"
              ? (org?.slug ?? "")
              : kind === "sla"
                ? get(f, "target")
                : name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "")
                    .slice(0, 60) || crypto.randomUUID());
        const config =
          kind === "company_profile"
            ? {
                legalName: get(f, "legalName"),
                address: get(f, "address"),
                email: get(f, "email"),
                phone: get(f, "phone"),
                gstin: get(f, "gstin"),
              }
            : kind === "product_category"
              ? { description: get(f, "description"), unit: get(f, "unit") }
              : kind === "payment_template"
                ? {
                    description: get(f, "description"),
                    percentage: get(f, "percentage"),
                    offsetDays: Number(get(f, "offsetDays")),
                    beforeDispatch: get(f, "beforeDispatch") === "yes",
                  }
                : kind === "document_requirement"
                  ? {
                      description: get(f, "description"),
                      stageNumber: Number(get(f, "stageNumber")),
                    }
                  : kind === "sla"
                    ? {
                        description: get(f, "description"),
                        target: get(f, "target"),
                        graceHours: Number(get(f, "graceHours")),
                      }
                    : { description: get(f, "description") };
        return save({
          id: edit?.id,
          organizationId: company,
          kind,
          code,
          name,
          active: get(f, "active") === "yes",
          version: edit?.version ?? 0,
          config,
          notes: get(f, "notes"),
        });
      }}
    >
      <label className="block space-y-2 text-xs font-medium">
        Company
        <select
          className={selectClass}
          required
          disabled={!!edit}
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        >
          <option value="">Choose company</option>
          {d.companies.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      {kind !== "company_profile" && (
        <Field label="Setting name" name="name" defaultValue={edit?.name} />
      )}
      {kind === "company_profile" ? (
        <>
          <p className="text-sm font-medium">{org?.name ?? "Choose a company"}</p>
          <Field label="Legal name" name="legalName" defaultValue={value("legalName", org?.name)} />
          <Field
            label="Company address"
            name="address"
            required={false}
            defaultValue={value("address")}
          />
          <Field
            label="Contact email"
            type="email"
            name="email"
            required={false}
            defaultValue={value("email")}
          />
          <Field
            label="Contact phone"
            name="phone"
            required={false}
            defaultValue={value("phone")}
          />
          <Field label="GSTIN" name="gstin" required={false} defaultValue={value("gstin")} />
        </>
      ) : (
        <Field
          label="Description"
          name="description"
          required={false}
          defaultValue={value("description")}
        />
      )}
      {kind === "product_category" && (
        <Field label="Quantity unit" name="unit" defaultValue={value("unit", "items")} />
      )}
      {kind === "payment_template" && (
        <>
          <Field
            label="Percentage of confirmed order value"
            name="percentage"
            defaultValue={value("percentage")}
          />
          <Field
            label="Due after days from order date"
            name="offsetDays"
            type="number"
            defaultValue={value("offsetDays", "0")}
          />
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              name="beforeDispatch"
              value="yes"
              defaultChecked={Boolean(c.beforeDispatch ?? true)}
            />
            Required before dispatch
          </label>
        </>
      )}
      {kind === "document_requirement" && (
        <Select
          label="Workflow stage"
          name="stageNumber"
          values={postSalesStages.map((name, n) => ({
            id: String(n + 1),
            name: `${n + 1}. ${name}`,
          }))}
          defaultValue={value("stageNumber")}
        />
      )}
      {kind === "sla" && (
        <>
          <Select
            label="Delay target"
            name="target"
            values={["follow_up", "production", "payment", "dispatch", "installation", "audit"].map(
              (s) => ({ id: s, name: s.replaceAll("_", " ") }),
            )}
            defaultValue={value("target")}
          />
          <Field
            label="Grace period (hours)"
            name="graceHours"
            type="number"
            defaultValue={value("graceHours", "0")}
          />
        </>
      )}
      <label className="flex gap-2 text-sm">
        <input type="checkbox" name="active" value="yes" defaultChecked={edit?.active ?? true} />
        {kind === "company_profile" ? "Allow new leads" : "Active for new use"}
      </label>
      <Field label="Change reason" name="notes" />
      {edit && (
        <Button type="button" variant="outline" onClick={cancel}>
          Cancel editing
        </Button>
      )}
    </Form>
  );
}
