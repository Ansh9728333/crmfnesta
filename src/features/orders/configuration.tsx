"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { roles } from "@/lib/auth/roles";
import { stageDefinitions, stageDefinition } from "@/lib/orders/definitions";
import { requestJson, selectClass } from "@/features/leads/utils";
import { Labeled } from "./fields";
import type { OrderConfiguration } from "./types";
function PolicyForm({
  company,
  number,
  policy,
  onSaved,
}: {
  company: string;
  number: number;
  policy: OrderConfiguration["policies"][number] | undefined;
  onSaved: () => Promise<void>;
}) {
  const def = stageDefinition(number),
    [owner, setOwner] = useState<string>(policy?.ownerRole ?? def.ownerRole),
    [approver, setApprover] = useState<string>(policy?.approverRole ?? def.approverRole),
    [required, setRequired] = useState(policy?.requiredFields ?? def.requiredFields),
    [apply, setApply] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const fields = [
    { key: "notes", label: "Stage notes" },
    { key: "attachments", label: "At least one private attachment" },
    ...def.fields,
  ];
  return (
    <form
      className="space-y-5 rounded-xl border bg-white p-5 sm:p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await requestJson("/api/orders/configuration", "POST", {
            organizationId: company,
            number,
            version: policy?.version ?? 0,
            ownerRole: owner,
            approverRole: approver,
            requiredFields: required,
            applyToPending: apply,
          });
          await onSaved();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-xl font-semibold">
        {def.number}. {def.name}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Labeled label="Responsible owner role">
          {(id) => (
            <select
              id={id}
              className={selectClass}
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            >
              {roles.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          )}
        </Labeled>
        <Labeled label="Approval responsibility">
          {(id) => (
            <select
              id={id}
              className={selectClass}
              value={approver}
              onChange={(e) => setApprover(e.target.value)}
            >
              {roles.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          )}
        </Labeled>
      </div>
      <p className="text-xs text-muted-foreground">
        Owner roles need orders.read and {def.permission}. Approver roles need orders.read
        {def.approvalPermission !== "orders.read" ? ` and ${def.approvalPermission}` : ""}.
        Administrators may review stages but cannot bypass evidence or prerequisite checks.
      </p>
      <fieldset className="space-y-3">
        <legend className="mb-4 text-sm font-semibold">Mandatory fields</legend>
        {fields.map((field) => (
          <label key={field.key} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={required.includes(field.key)}
              disabled={def.requiredFields.includes(field.key)}
              onChange={(e) =>
                setRequired((prev) =>
                  e.target.checked ? [...prev, field.key] : prev.filter((k) => k !== field.key),
                )
              }
            />
            <span>
              {field.label}
              {def.requiredFields.includes(field.key) && (
                <span className="ml-2 text-xs text-muted-foreground">Core requirement</span>
              )}
            </span>
          </label>
        ))}
      </fieldset>
      <p className="rounded-lg bg-accent p-4 text-xs">
        The shared stage sequence, Won prerequisite, WhatsApp records, survey approval, load
        planning, payment verification, installation/audit checks and handover order cannot be
        disabled. Reviews never require a positive outcome.
      </p>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} />
        Apply to existing pending stages too. Started and approved stages retain their policy
        snapshots. Changing the owner role clears pending assignments so eligible employees can be
        reassigned.
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button disabled={busy}>{busy ? "Saving…" : "Save stage configuration"}</Button>
    </form>
  );
}
export function WorkflowConfiguration({ initial }: { initial: OrderConfiguration }) {
  const [data, setData] = useState(initial),
    [company, setCompany] = useState(initial.companies[0]?.id ?? ""),
    [number, setNumber] = useState(1),
    policy = data.policies.find((p) => p.organizationId === company && p.number === number);
  return (
    <div className="space-y-6">
      <header>
        <Link href="/orders" className="text-xs font-semibold text-primary">
          ← Order management
        </Link>
        <h1 className="mt-4 text-3xl font-semibold">Stage responsibilities & requirements</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          One engine and sequence, with company-scoped responsibility policies. All changes are
          audited.
        </p>
      </header>
      <div className="grid gap-4 rounded-xl border bg-white p-5 sm:grid-cols-2">
        <Labeled label="Configure company">
          {(id) => (
            <select
              id={id}
              className={selectClass}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            >
              {data.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </Labeled>
        <Labeled label="Configure stage">
          {(id) => (
            <select
              id={id}
              className={selectClass}
              value={number}
              onChange={(e) => setNumber(Number(e.target.value))}
            >
              {stageDefinitions.map((s) => (
                <option key={s.number} value={s.number}>
                  {s.number}. {s.name}
                </option>
              ))}
            </select>
          )}
        </Labeled>
      </div>
      {company && (
        <PolicyForm
          key={`${company}-${number}-${policy?.version ?? 0}`}
          company={company}
          number={number}
          policy={policy}
          onSaved={async () =>
            setData(await requestJson<OrderConfiguration>("/api/orders/configuration"))
          }
        />
      )}
    </div>
  );
}
