import Link from "next/link";
import { headers } from "next/headers";
import { getLeadService } from "@/lib/leads";
import { getPresalesService } from "@/lib/presales";
import { requireAccess } from "@/lib/auth/server";
import { eligibleAssignments } from "@/lib/leads/access";
import { dateTime, money } from "@/features/leads/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";
export async function PresalesModulePage({
  kind,
  searchParams,
}: {
  kind: "appointments" | "quotations";
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const a = await requireAccess(),
    permission = kind === "appointments" ? "appointments.manage" : "quotations.manage";
  if (!eligibleAssignments(a, permission).length || !eligibleAssignments(a, "leads.read").length)
    return (
      <section>
        <h1 className="text-2xl font-semibold">Access restricted</h1>
        <p className="mt-3 text-sm">
          This module requires lead access and {permission} permission.
        </p>
      </section>
    );
  const query = await searchParams,
    filters = z
      .object({
        q: z.string().trim().max(200).default(""),
        page: z.coerce.number().int().min(1).max(100000).default(1),
      })
      .safeParse(query),
    filter = filters.success ? filters.data : { q: "", page: 1 },
    h = await headers(),
    result = await getPresalesService().list(h, kind, filter),
    leads = await getLeadService().list(h, { q: filter.q, page: filter.page, pageSize: 20 }),
    visits = kind === "appointments";
  const href = (page: number) =>
    `/${kind}?${new URLSearchParams({ q: filter.q, page: String(page) })}`;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Shared pre-sales
        </p>
        <h1 className="mt-2 text-3xl font-semibold">
          {visits ? "Appointments & site visits" : "Versioned quotations"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {visits
            ? "Plan visits, capture initial measurements and preserve site history."
            : "Issue item-wise offers, record acceptance and preserve every revision."}
        </p>
      </header>
      <form className="flex gap-3 rounded-xl border bg-white p-4">
        <Input
          name="q"
          aria-label="Search client"
          defaultValue={filter.q}
          placeholder="Search client name"
        />
        <Button>Search</Button>
      </form>
      <section className="rounded-xl border bg-white p-5">
        <h2 className="mb-4 font-semibold">
          {visits ? "Scheduled and historical visits" : "Quotation versions"}{" "}
          <span className="text-sm font-normal text-muted-foreground">({result.total})</span>
        </h2>
        {!result.rows.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No {kind} match this page. Select a lead below to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  {[
                    "Customer",
                    "Company",
                    "Reference",
                    "Date (IST)",
                    visits ? "Status" : "Amount",
                    "",
                  ].map((name, i) => (
                    <th key={i} className="p-3">
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="p-3 font-semibold">
                      {r.client}
                      {r.employee && (
                        <p className="mt-1 font-normal text-muted-foreground">{r.employee}</p>
                      )}
                    </td>
                    <td className="p-3">{r.company}</td>
                    <td className="p-3">{r.reference}</td>
                    <td className="p-3 whitespace-nowrap">{dateTime(r.date.toISOString())}</td>
                    <td className="p-3">
                      {visits ? <Badge variant="outline">{r.status}</Badge> : money(r.amount)}
                    </td>
                    <td className="p-3">
                      <Link
                        className="font-semibold text-primary"
                        href={`/leads/${r.leadId}/presales?tab=${visits ? "visits" : "quotations"}`}
                      >
                        Open workspace →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="rounded-xl border bg-white p-5">
        <h2 className="font-semibold">Select an opportunity</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Open a lead to{" "}
          {visits ? "schedule a visit or record its outcome" : "create or revise a quotation"}.
          Search above to find a customer.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {leads.rows.map((l) => (
            <Link
              key={l.id}
              className="rounded-lg border p-4 text-sm hover:bg-accent"
              href={`/leads/${l.id}/presales?tab=${visits ? "visits" : "quotations"}`}
            >
              <strong>{l.clientName}</strong>
              <p className="mt-2 text-xs text-muted-foreground">
                {l.companyName} · {l.projectName}
              </p>
              <p className="mt-2 text-xs">{l.outcome ?? "Open"}</p>
            </Link>
          ))}
        </div>
        {!leads.rows.length && (
          <p className="py-6 text-sm text-muted-foreground">
            No accessible leads match this page.{" "}
            <Link href="/leads" className="text-primary underline">
              Manage leads
            </Link>
          </p>
        )}
      </section>
      <div className="flex items-center justify-between">
        {filter.page > 1 ? (
          <Button asChild variant="outline">
            <Link href={href(filter.page - 1)}>Previous</Link>
          </Button>
        ) : (
          <Button variant="outline" disabled>
            Previous
          </Button>
        )}
        <span className="text-xs">Page {filter.page}</span>
        {filter.page * 20 < Math.max(result.total, leads.total) && (
          <Button asChild variant="outline">
            <Link href={href(filter.page + 1)}>Next</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
