"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { CustomerList, Directory } from "./types";
import { emptyLead, requestJson, selectClass } from "./utils";

type ParentRow = {
  id: string;
  organizationId: string;
  name: string;
  mobile?: string | null;
  email?: string | null;
  siteAddress?: string | null;
  customerId?: string;
  centreId: string | null;
  assignedTo: string | null;
};
export function ParentWorkspace({
  kind,
  initial,
  directory,
  query,
}: {
  kind: "customers" | "projects";
  initial: { rows: ParentRow[]; total: number; page: number; pageSize: number };
  directory: Directory;
  query: Record<string, string>;
}) {
  const router = useRouter(),
    label = kind === "customers" ? "Customer" : "Project";
  const [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const defaults = emptyLead(directory),
    [org, setOrg] = useState(defaults.organizationId),
    [centre, setCentre] = useState(defaults.centreId),
    [employee, setEmployee] = useState(defaults.assignedTo),
    [customer, setCustomer] = useState(query.customerId ?? ""),
    [customerResults, setCustomerResults] = useState<CustomerList | null>(null),
    [customerQuery, setCustomerQuery] = useState("");
  const people = [
    ...new Map(
      directory.employees
        .filter(
          (p) =>
            p.organizationId === org &&
            p.centreId === centre &&
            (directory.coordinatorCentres.includes(centre) || p.id === directory.currentUserId),
        )
        .map((p) => [p.id, p]),
    ).values(),
  ];
  const url = (patch: Record<string, string | number>) => {
    const params = new URLSearchParams({
      ...query,
      ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, String(v)])),
    });
    return `/${kind}?${params}`;
  };
  async function findCustomers(page = 1) {
    try {
      setCustomerResults(
        await requestJson<CustomerList>(
          `/api/customers?organizationId=${org}&q=${encodeURIComponent(customerQuery)}&page=${page}&pageSize=20`,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Customer lookup failed");
    }
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
            CUSTOMER RELATIONSHIPS
          </p>
          <h1 className="mt-2 text-3xl font-semibold">
            {kind === "customers"
              ? "People behind every project."
              : "A place for every possibility."}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {kind === "customers"
              ? "One customer, multiple projects. Keep the relationship connected."
              : "Link every site and opportunity to the right customer."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/leads">Sales pipeline</Link>
          </Button>
          {directory.canCreate && (
            <Button
              onClick={() => {
                setError("");
                setOpen(true);
              }}
            >
              <Plus size={15} />
              Add {label.toLowerCase()}
            </Button>
          )}
        </div>
      </div>
      {notice && (
        <p role="status" className="rounded-lg border bg-accent p-4 text-xs text-primary">
          {notice}
        </p>
      )}
      <form
        className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-[2fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          router.push(
            url({
              q: String(data.get("q")),
              organizationId: String(data.get("organizationId")),
              page: 1,
            }),
          );
        }}
      >
        <Input
          name="q"
          aria-label={`Search ${kind}`}
          placeholder={kind === "customers" ? "Search customer or mobile" : "Search project name"}
          defaultValue={query.q}
        />
        <select
          aria-label="Company filter"
          name="organizationId"
          className={selectClass}
          defaultValue={query.organizationId ?? ""}
        >
          <option value="">All companies</option>
          {directory.organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <Button>Search</Button>
      </form>
      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <caption className="sr-only">{label} directory</caption>
            <thead className="bg-background text-[10px] uppercase text-muted-foreground">
              <tr>
                {[
                  label,
                  "Company",
                  kind === "customers" ? "Contact" : "Site address",
                  "Branch",
                  "Relationships",
                ].map((h) => (
                  <th className="px-5 py-4 font-medium" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initial.rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-5 py-5 font-semibold">{row.name}</td>
                  <td className="px-5 py-5">
                    {directory.organizations.find((o) => o.id === row.organizationId)?.name}
                  </td>
                  <td className="max-w-72 whitespace-pre-wrap px-5 py-5">
                    {kind === "customers" ? (
                      <>
                        <p>{row.mobile}</p>
                        <p className="mt-1 text-muted-foreground">{row.email}</p>
                      </>
                    ) : (
                      row.siteAddress
                    )}
                  </td>
                  <td className="px-5 py-5">
                    {directory.centres.find((c) => c.id === row.centreId)?.name ?? "—"}
                  </td>
                  <td className="px-5 py-5">
                    <div className="flex flex-wrap gap-3">
                      {kind === "customers" && (
                        <Link
                          className="font-semibold text-primary underline"
                          href={`/projects?customerId=${row.id}`}
                        >
                          Projects
                        </Link>
                      )}
                      <Link
                        className="font-semibold text-primary underline"
                        href={`/leads?${kind === "customers" ? "customerId" : "projectId"}=${row.id}&view=table`}
                      >
                        Leads
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!initial.rows.length && (
            <div className="p-12 text-center">
              <h2 className="font-semibold">No matching {kind}</h2>
              <p className="mt-2 text-xs text-muted-foreground">
                Create a {label.toLowerCase()} or adjust the filters.
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-xs">
          <span>
            {initial.total} matching {kind} · Page {initial.page} of{" "}
            {Math.max(1, Math.ceil(initial.total / initial.pageSize))}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={initial.page <= 1}
              onClick={() => router.push(url({ page: initial.page - 1 }))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={initial.page * initial.pageSize >= initial.total}
              onClick={() => router.push(url({ page: initial.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      </section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogTitle>Add {label.toLowerCase()}</DialogTitle>
          <DialogDescription>
            {kind === "customers"
              ? "Create a customer contact. Projects and leads can then be linked to it."
              : "Create another project for an existing customer without duplicating the contact."}
          </DialogDescription>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const form = new FormData(e.currentTarget),
                body = {
                  organizationId: org,
                  centreId: centre,
                  assignedTo: employee,
                  name: form.get("name"),
                  ...(kind === "customers"
                    ? { mobile: form.get("mobile"), email: form.get("email") ?? "" }
                    : { customerId: customer, siteAddress: form.get("siteAddress") }),
                };
              try {
                await requestJson(`/api/${kind}`, "POST", body);
                setOpen(false);
                setNotice(`${label} created.`);
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Unable to save");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="block text-xs">
              Company
              <select
                className={`${selectClass} mt-2`}
                value={org}
                onChange={(e) => {
                  const c = directory.centres.find((c) => c.organizationId === e.target.value),
                    p =
                      directory.employees.find(
                        (p) => p.centreId === c?.id && p.id === directory.currentUserId,
                      ) ?? directory.employees.find((p) => p.centreId === c?.id);
                  setOrg(e.target.value);
                  setCentre(c?.id ?? "");
                  setEmployee(p?.id ?? "");
                  setCustomer("");
                  setCustomerResults(null);
                }}
              >
                {directory.organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              Centre / Branch
              <select
                className={`${selectClass} mt-2`}
                value={centre}
                onChange={(e) => {
                  setCentre(e.target.value);
                  const p =
                    directory.employees.find(
                      (p) => p.centreId === e.target.value && p.id === directory.currentUserId,
                    ) ?? directory.employees.find((p) => p.centreId === e.target.value);
                  setEmployee(p?.id ?? "");
                }}
              >
                {directory.centres
                  .filter((c) => c.organizationId === org)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-xs">
              Assigned employee
              <select
                className={`${selectClass} mt-2`}
                value={employee}
                onChange={(e) => setEmployee(e.target.value)}
                required
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
            </label>
            {kind === "projects" && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    aria-label="Find customer"
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                    placeholder="Find customer by name or mobile"
                  />
                  <Button type="button" variant="outline" onClick={() => void findCustomers()}>
                    Find
                  </Button>
                </div>
                <label className="block text-xs">
                  Customer
                  <select
                    className={`${selectClass} mt-2`}
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    required
                  >
                    <option value="">Select customer</option>
                    {customer && !customerResults?.rows.some((c) => c.id === customer) && (
                      <option value={customer}>Linked customer</option>
                    )}
                    {customerResults?.rows.map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.name} · {c.mobile}
                      </option>
                    ))}
                  </select>
                </label>
                {customerResults && (
                  <div className="flex items-center justify-between text-xs">
                    <span>{customerResults.total} matching customers</span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        type="button"
                        size="sm"
                        disabled={customerResults.page === 1}
                        onClick={() => void findCustomers(customerResults.page - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="ghost"
                        type="button"
                        size="sm"
                        disabled={customerResults.page * 20 >= customerResults.total}
                        onClick={() => void findCustomers(customerResults.page + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <label className="block text-xs">
              {label} name
              <Input className="mt-2" name="name" minLength={2} maxLength={120} required />
            </label>
            {kind === "customers" ? (
              <>
                <label className="block text-xs">
                  Mobile no.
                  <Input className="mt-2" name="mobile" type="tel" maxLength={25} required />
                </label>
                <label className="block text-xs">
                  Email (optional)
                  <Input className="mt-2" name="email" type="email" />
                </label>
              </>
            ) : (
              <label className="block text-xs">
                Site address
                <textarea
                  className="mt-2 min-h-24 w-full rounded-md border p-3 text-sm"
                  name="siteAddress"
                  minLength={5}
                  maxLength={1000}
                  required
                />
              </label>
            )}
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <Button className="w-full" disabled={busy}>
              {busy ? "Saving…" : `Create ${label.toLowerCase()}`}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
