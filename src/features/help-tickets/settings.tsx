"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestJson } from "@/features/leads/utils";
import { Field, selectClass } from "./shared";
import type { Policy } from "./types";
export function HelpSettings({ companies }: { companies: { id: string; name: string }[] }) {
  const [org, setOrg] = useState(""),
    [rows, setRows] = useState<Policy[]>([]),
    [selected, setSelected] = useState<Policy | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function load(id: string) {
    setOrg(id);
    setSelected(null);
    setNotice("");
    setError("");
    setBusy(true);
    try {
      setRows(id ? await requestJson(`/api/help-tickets/settings?organizationId=${id}`) : []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/help-tickets" className="text-sm text-primary">
        ← Help Tickets
      </Link>
      <header>
        <h1 className="text-3xl font-semibold">Help Ticket Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Configure concern types, mandatory evidence and resolution targets. Existing tickets
          retain their original requirements.
        </p>
      </header>
      <Field label="Company">
        <select
          value={org}
          onChange={(e) => void load(e.target.value)}
          className={selectClass}
          disabled={busy}
        >
          <option value="">Select company</option>
          {companies.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </Field>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-primary">
          {notice}
        </p>
      )}
      {org && (
        <>
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-4 rounded-lg border bg-card p-4"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {r.name} {!r.active && "(disabled)"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Attachment {r.attachmentRequired ? "required" : "optional"} ·{" "}
                    {r.slaHours ? `${r.slaHours} hours SLA` : "No SLA"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setSelected(r);
                    setError("");
                    setNotice("");
                  }}
                >
                  Edit
                </Button>
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={() => setSelected(null)}>
            New concern type
          </Button>
          <form
            key={selected?.id ?? "new"}
            className="space-y-4 rounded-xl border bg-card p-5"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              setError("");
              setNotice("");
              try {
                await requestJson("/api/help-tickets/settings", "POST", {
                  organizationId: org,
                  code: String(f.get("code")),
                  name: String(f.get("name")),
                  active: f.has("active"),
                  attachmentRequired: f.has("attachmentRequired"),
                  slaHours: f.get("slaHours") ? Number(f.get("slaHours")) : null,
                  version: selected?.version ?? 0,
                  notes: String(f.get("notes")),
                });
                await load(org);
                setNotice("Concern settings saved.");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <h2 className="font-semibold">{selected ? "Edit concern" : "Add concern"}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Code *">
                <Input
                  name="code"
                  required
                  readOnly={Boolean(selected)}
                  defaultValue={selected?.code}
                  pattern="[a-z0-9_-]{1,60}"
                  maxLength={60}
                />
              </Field>
              <Field label="Name *">
                <Input
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  defaultValue={selected?.name}
                />
              </Field>
              <Field label="SLA hours (blank for no target)">
                <Input
                  name="slaHours"
                  type="number"
                  min={1}
                  max={8760}
                  step={1}
                  defaultValue={selected?.slaHours ?? ""}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={selected?.active ?? true} />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="attachmentRequired"
                defaultChecked={selected?.attachmentRequired ?? false}
              />
              Require supporting attachment
            </label>
            <Field label="Reason for change *">
              <Input name="notes" required minLength={3} maxLength={1000} />
            </Field>
            <Button disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button>
          </form>
        </>
      )}
    </div>
  );
}
