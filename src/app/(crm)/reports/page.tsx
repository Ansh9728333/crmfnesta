import Link from "next/link";
import { headers } from "next/headers";
import { z } from "zod";
import { requireAccess } from "@/lib/auth/server";
import { eligibleAssignments } from "@/lib/leads/access";
import { getManagementService } from "@/lib/management";
import { filterSchema, reports, type Report } from "@/lib/management/validation";
import { ManagementFilters } from "@/features/management/filters";
import { ReportTable } from "@/features/management/report-table";
import { reportStatuses } from "@/lib/management/service";
import { redirect } from "next/navigation";
export const metadata = { title: "Management reports" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const a = await requireAccess();
  if (!eligibleAssignments(a, "reports.read").length)
    return (
      <section>
        <h1 className="text-2xl font-semibold">Access restricted</h1>
        <p className="mt-3 text-sm">Reports permission is required.</p>
      </section>
    );
  const q = await searchParams,
    f = filterSchema.safeParse(q),
    type = z.enum(Object.keys(reports) as [Report, ...Report[]]).safeParse(q.type ?? "sales");
  if (!f.success || !type.success)
    return (
      <p>
        Invalid report filters.{" "}
        <Link href="/reports" className="underline">
          Clear filters
        </Link>
      </p>
    );
  if (f.data.status && !reportStatuses[type.data].includes(f.data.status))
    redirect(
      `/reports?${new URLSearchParams({ ...f.data, type: type.data, status: "", page: "1" })}`,
    );
  const service = getManagementService(),
    h = await headers(),
    directory = await service.directory(h);
  if (
    type.data === "payments" &&
    (!directory.financial ||
      (f.data.organizationId && !directory.financialCompanyIds.includes(f.data.organizationId)))
  )
    return <p>Payment access is required for collection reports and exports.</p>;
  const data = await service.report(h, type.data, f.data);
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Management intelligence
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Reports</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Real records with consistent access checks, pagination and complete filtered exports.
        </p>
      </header>
      <ManagementFilters
        directory={JSON.parse(JSON.stringify(directory))}
        f={f.data}
        type={type.data}
      />
      <ReportTable data={JSON.parse(JSON.stringify(data))} />
      <p className="text-xs leading-6 text-muted-foreground">
        Lead reports use lead creation dates; operational reports use the related order creation
        date. Quotations use issue date and collection reports use payment date. Date endpoints are
        inclusive in IST. Exports include all matching rows, up to 10,000; exact monetary values
        remain decimal text in Excel.
      </p>
    </div>
  );
}
