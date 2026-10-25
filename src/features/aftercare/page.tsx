import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAccess } from "@/lib/auth/server";
import { eligibleAssignments } from "@/lib/leads/access";
import { getAftercareService } from "@/lib/aftercare";
import { aftercareFilters } from "@/lib/aftercare/validation";
import { AccessError } from "@/lib/auth/access";
import { selectClass, dateTime } from "@/features/leads/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AftercareWorkspace } from "./workspace";
import { getDb } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
export async function AftercarePage({
  searchParams,
  mode,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
  mode: "installations" | "service";
}) {
  const a = await requireAccess(),
    q = await searchParams;
  if (
    !(["orders.manage", "installations.manage", "audits.manage", "service.manage"] as const).some(
      (p) => eligibleAssignments(a, p).length,
    )
  )
    return <p>Your role does not include installation or customer service access.</p>;
  const api = getAftercareService(),
    h = await headers();
  if (q.orderId) {
    if (!z.uuid().safeParse(q.orderId).success) notFound();
    const d = await api.detail(h, q.orderId, Number(q.historyPage ?? 1)).catch((e: unknown) => {
      if (e instanceof AccessError && e.status === 404) notFound();
      throw e;
    });
    return (
      <AftercareWorkspace
        key={`${d.order.id}-${d.events[0]?.id ?? "empty"}`}
        d={JSON.parse(JSON.stringify(d))}
        mode={mode}
      />
    );
  }
  const parsed = aftercareFilters.safeParse(q);
  if (!parsed.success)
    return (
      <p>
        Invalid filters. <Link href={`/${mode}`}>Clear filters</Link>
      </p>
    );
  const f = parsed.data,
    r = await api.list(h, f, mode),
    companies = await getDb()
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(inArray(organizations.id, [...new Set(a.assignments.map((x) => x.organizationId))]));
  const href = (page: number) => `/${mode}?${new URLSearchParams({ ...f, page: String(page) })}`;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Site delivery & customer care
        </p>
        <h1 className="mt-2 text-3xl font-semibold">
          {mode === "installations" ? "Installation, audit & handover" : "Customer service"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {mode === "installations"
            ? "Complete each load, approve site quality and record customer acceptance."
            : "Track feedback, assigned service requests and complaint resolution after handover."}
        </p>
      </header>
      <form className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          aria-label="Search customer"
          name="q"
          placeholder="Search customer"
          defaultValue={f.q}
        />
        <select
          name="organizationId"
          aria-label="Company"
          className={selectClass}
          defaultValue={f.organizationId}
        >
          <option value="">All assigned companies</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
        {mode === "service" && (
          <>
            <select
              name="status"
              aria-label="Ticket status"
              className={selectClass}
              defaultValue={f.status}
            >
              <option value="">All statuses</option>
              {["open", "in_progress", "waiting_customer", "resolved", "closed"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            <select
              name="priority"
              aria-label="Priority"
              className={selectClass}
              defaultValue={f.priority}
            >
              <option value="">All priorities</option>
              {["low", "normal", "high", "urgent"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                name="overdue"
                value="yes"
                type="checkbox"
                defaultChecked={f.overdue === "yes"}
              />
              Overdue only
            </label>
          </>
        )}
        <Button>Apply filters</Button>
        <Link className="text-sm underline" href={`/${mode}`}>
          Clear filters
        </Link>
      </form>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {r.rows.map((row) => (
          <Link
            key={row.id}
            href={`/${mode}?orderId=${"orderId" in row ? row.orderId : row.id}`}
            className="space-y-3 rounded-xl border bg-white p-5 hover:border-primary"
          >
            <p className="text-xs font-semibold text-primary">{row.company}</p>
            <h2 className="font-semibold">{row.client}</h2>
            {"title" in row ? (
              <>
                <p className="text-sm">{row.title}</p>
                <p className="text-xs text-muted-foreground">
                  {row.status.replaceAll("_", " ")} · {row.priority} · Due {dateTime(row.dueAt)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Workflow stage {row.stage} of 16 · Open site workspace
              </p>
            )}
          </Link>
        ))}
      </div>
      {!r.total && (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <h2 className="font-semibold">
            {mode === "service" ? "No matching service tickets" : "No matching won orders"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "service"
              ? "Open a handed-over order to record feedback or create a service ticket."
              : "Installation becomes available after confirmed material delivery."}
          </p>
          <Link href="/orders" className="mt-4 inline-block underline">
            View orders
          </Link>
        </div>
      )}
      <nav aria-label="Pagination" className="flex justify-between text-sm">
        {f.page > 1 ? <Link href={href(f.page - 1)}>Previous</Link> : <span />}
        <span>
          {r.total} records · Page {f.page}
        </span>
        {f.page * 20 < r.total ? <Link href={href(f.page + 1)}>Next</Link> : <span />}
      </nav>
    </div>
  );
}
