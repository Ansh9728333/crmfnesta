"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { requestJson } from "@/features/leads/utils";
import { priorities } from "@/lib/help-tickets/validation";
import type { HelpSource } from "@/lib/help-tickets/service";
import type { Directory, Context } from "./types";
import { Field, selectClass, textareaClass, uploadHelpFile } from "./shared";
export function CreateTicket({ directory: d }: { directory: Directory }) {
  const router = useRouter(),
    trigger = useRef<HTMLButtonElement | null>(null),
    request = useRef(0);
  const [open, setOpen] = useState(Boolean(d.selected)),
    [org, setOrg] = useState(d.intakeOrganizationId),
    [employees, setEmployees] = useState(d.resolvers),
    [policies, setPolicies] = useState(d.policies),
    [clients, setClients] = useState<HelpSource[]>(d.clients),
    [selected, setSelected] = useState<HelpSource | null>(d.selected),
    [clientId, setClientId] = useState(d.selected?.customerId ?? ""),
    [related, setRelated] = useState<HelpSource[]>([]),
    [location, setLocation] = useState(
      d.selected?.location ??
        d.centres.find((c) => c.organizationId === d.intakeOrganizationId)?.name ??
        "",
    ),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [concern, setConcern] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [requestId, setRequestId] = useState("");
  const policy = policies.find((x) => x.code === concern);
  async function find(next = 1) {
    setBusy(true);
    setError("");
    try {
      setClients(
        await requestJson(
          `/api/help-tickets/context?kind=customer&organizationId=${org}&q=${encodeURIComponent(search)}&page=${next}`,
        ),
      );
      setPage(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function company(id: string) {
    const seq = ++request.current;
    setOrg(id);
    setSelected(null);
    setClientId("");
    setRelated([]);
    setClients([]);
    setEmployees([]);
    setPolicies([]);
    setConcern("");
    setFile(null);
    setRequestId("");
    setPage(1);
    setSearch("");
    setLocation(d.centres.find((c) => c.organizationId === id)?.name ?? "");
    setBusy(true);
    setError("");
    try {
      const r = await requestJson<{
        employees: Directory["resolvers"];
        policies: Directory["policies"];
        clients: HelpSource[];
      }>(`/api/help-tickets/context?mode=intake&organizationId=${id}`);
      if (seq === request.current) {
        setEmployees(r.employees);
        setPolicies(r.policies);
        setClients(r.clients);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (seq === request.current) setBusy(false);
    }
  }
  async function choose(kind: HelpSource["kind"], id: string) {
    setBusy(true);
    setError("");
    try {
      const r = await requestJson<Context>(`/api/help-tickets/context?kind=${kind}&id=${id}`);
      setSelected(r.source);
      setClientId(r.source.customerId);
      setRelated(r.related);
      setEmployees(r.resolvers);
      setPolicies(r.policies);
      setOrg(r.source.organizationId);
      setLocation((x) => x || r.source.location);
      if (selected?.kind !== r.source.kind || selected?.id !== r.source.id) setFile(null);
      setRequestId("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        ref={trigger}
        disabled={!d.canRaise}
        onClick={() => {
          setOpen(true);
          setError("");
        }}
      >
        Raise Help Ticket
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
      >
        <DialogContent
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            trigger.current?.focus();
          }}
          className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"
        >
          <DialogTitle>Raise Help Ticket</DialogTitle>
          <DialogDescription>
            Complete the help form. Client and employee lists include your company&apos;s records
            from every employee.
          </DialogDescription>
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <form
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!selected) {
                setError("Select an existing client before submitting.");
                return;
              }
              setBusy(true);
              setError("");
              const f = new FormData(e.currentTarget);
              try {
                const id = requestId || crypto.randomUUID();
                setRequestId(id);
                const fileId = file
                  ? await uploadHelpFile(file, { source: { kind: selected.kind, id: selected.id } })
                  : undefined;
                const result = await requestJson<{ id: string }>("/api/help-tickets", "POST", {
                  kind: selected.kind,
                  id: selected.id,
                  requestId: id,
                  location,
                  concern,
                  details: String(f.get("details")),
                  assignedTo: String(f.get("assignedTo")),
                  priority: String(f.get("priority")),
                  ...(fileId ? { fileId } : {}),
                });
                setOpen(false);
                window.dispatchEvent(new Event("siteflow-notifications-updated"));
                router.push(`/help-tickets/${result.id}`);
                router.refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your Location ? *">
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  list="help-location-options"
                  placeholder="Select or type your location"
                  required
                  maxLength={200}
                />
                <datalist id="help-location-options">
                  {d.centres
                    .filter((x) => x.organizationId === org)
                    .map((x) => (
                      <option key={x.id} value={x.name} />
                    ))}
                </datalist>
              </Field>
              <Field label="Your Name ? *">
                <Input value={d.currentUser.name} readOnly />
              </Field>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Your logged-in name is recorded as the submitter and receives resolution confirmation.
            </p>
            <Field label="Company *">
              <select
                value={org}
                onChange={(e) => void company(e.target.value)}
                className={selectClass}
                disabled={busy}
                required
              >
                {d.companies.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </Field>
            <section className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <h3 className="text-sm font-semibold">Client Details</h3>
              <p className="text-xs text-muted-foreground">
                All company clients, regardless of which employee created the lead. Search by client
                name or mobile number.
              </p>
              <div className="flex gap-2">
                <Input
                  aria-label="Search client or mobile"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void find();
                    }
                  }}
                  placeholder="Client name or mobile"
                  value={search}
                  maxLength={100}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Button type="button" variant="outline" disabled={busy} onClick={() => void find()}>
                  Search
                </Button>
              </div>
              <Field label="Client Name *">
                <select
                  required
                  value={clientId}
                  disabled={busy}
                  className={selectClass}
                  onChange={(e) => {
                    setClientId(e.target.value);
                    if (e.target.value) void choose("customer", e.target.value);
                    else {
                      setSelected(null);
                      setRelated([]);
                    }
                  }}
                >
                  <option value="">Select client</option>
                  {selected && !clients.some((c) => c.id === selected.customerId) && (
                    <option value={selected.customerId}>
                      {selected.client} · {selected.mobile ?? ""}
                    </option>
                  )}
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.client} · {c.mobile ?? "No mobile recorded"}
                    </option>
                  ))}
                </select>
              </Field>
              {!clients.length && !busy && (
                <p role="status" className="text-xs text-muted-foreground">
                  No matching clients in this company. Try another name/mobile or company. Create
                  the customer in CRM first if it has not been registered.
                </p>
              )}
              <div className="flex items-center gap-2 text-xs">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || page === 1}
                  onClick={() => void find(page - 1)}
                >
                  Previous clients
                </Button>
                <span>Page {page}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || clients.length < 20}
                  onClick={() => void find(page + 1)}
                >
                  More clients
                </Button>
              </div>
              {selected && (
                <>
                  <p className="text-sm">
                    <strong>{selected.client}</strong> · {selected.mobile ?? "No mobile recorded"}
                  </p>
                  <Field label="Related lead / project (optional)">
                    <select
                      className={selectClass}
                      disabled={busy}
                      value={selected.kind === "customer" ? "" : `${selected.kind}:${selected.id}`}
                      onChange={(e) => {
                        if (!e.target.value) void choose("customer", clientId);
                        else {
                          const [kind, id] = e.target.value.split(":");
                          void choose(kind as HelpSource["kind"], id);
                        }
                      }}
                    >
                      <option value="">Client only</option>
                      {selected.kind !== "customer" &&
                        !related.some((x) => x.kind === selected.kind && x.id === selected.id) && (
                          <option value={`${selected.kind}:${selected.id}`}>
                            {selected.name} · {selected.kind}
                          </option>
                        )}
                      {related.map((x) => (
                        <option key={x.kind + x.id} value={`${x.kind}:${x.id}`}>
                          {x.name} · {x.kind}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              )}
            </section>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Concern Type *">
                <select
                  required
                  value={concern}
                  onChange={(e) => setConcern(e.target.value)}
                  className={selectClass}
                  disabled={busy}
                >
                  <option value="">Select concern type</option>
                  {policies
                    .filter((p) => p.active)
                    .map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Priority *">
                <select name="priority" className={selectClass} defaultValue="normal">
                  {priorities.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field
              label={`If Any Supporting Attachment upload here${policy?.attachmentRequired ? " *" : " (optional)"}`}
            >
              <input
                key={selected?.kind + ":" + selected?.id}
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                required={policy?.attachmentRequired}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-xs"
              />
            </Field>
            <p className="text-xs text-muted-foreground">One PDF, JPEG or PNG · maximum 10 MB.</p>
            <Field label="Please Write the Details In Brief *">
              <textarea
                className={textareaClass}
                required
                minLength={5}
                maxLength={5000}
                name="details"
              />
            </Field>
            <Field label="Select The Name To whom you want to raise the ticket *">
              <select
                key={org}
                name="assignedTo"
                required
                className={selectClass}
                defaultValue=""
                disabled={busy}
              >
                <option value="">Select employee / resolver</option>
                {employees.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            {!employees.length && !busy && (
              <p role="status" className="text-xs text-muted-foreground">
                No active employees found for this company.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button disabled={busy || !selected || !employees.length}>
                {busy ? "Submitting…" : "Submit Help Ticket"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
