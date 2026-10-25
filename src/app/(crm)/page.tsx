import { getManagementService } from "@/lib/management";
import { ManagementDashboard } from "@/features/management/dashboard";
import { filterSchema } from "@/lib/management/validation";
import Link from "next/link";
import { headers } from "next/headers";
import { requireAccess } from "@/lib/auth/server";
import { accessiblePermissions } from "@/lib/auth/access";
import { eligibleAssignments } from "@/lib/leads/access";
import { getLeadService } from "@/lib/leads";
import { PreSalesOverview } from "@/features/dashboard/presales-overview";
import { modules } from "@/lib/navigation";
import { modulePermission } from "@/lib/auth/roles";
import { z } from "zod";
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const access = await requireAccess();
  if (eligibleAssignments(access, "reports.read").length) {
    const service = getManagementService(),
      h = await headers(),
      parsed = filterSchema.safeParse(await searchParams);
    if (!parsed.success)
      return (
        <p>
          Invalid dashboard filters. <Link href="/">Clear filters</Link>
        </p>
      );
    const data = await service.dashboard(h, parsed.data),
      directory = await service.directory(h);
    return (
      <ManagementDashboard
        data={JSON.parse(JSON.stringify(data))}
        directory={JSON.parse(JSON.stringify(directory))}
        name={access.user.name}
      />
    );
  }
  if (!eligibleAssignments(access, "leads.read").length) {
    const allowed = accessiblePermissions(access);
    return (
      <div>
        <p className="text-xs font-semibold text-primary">YOUR WORKSPACE</p>
        <h1 className="mt-3 text-3xl font-semibold">Welcome, {access.user.name}.</h1>
        <p className="mt-3 text-sm text-muted-foreground">Open a module available to your role.</p>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules
            .filter((m) => allowed.includes(modulePermission[m.slug]))
            .map((m) => (
              <Link key={m.slug} href={`/${m.slug}`} className="rounded-xl border bg-white p-6">
                <h2 className="font-semibold">{m.title}</h2>
                <p className="mt-3 text-xs leading-6 text-muted-foreground">{m.description}</p>
              </Link>
            ))}
        </div>
      </div>
    );
  }
  const { organizationId: raw } = await searchParams,
    organizationId = z.uuid().safeParse(raw).success ? raw! : "",
    service = getLeadService(),
    h = await headers(),
    directory = await service.directory(h),
    summary = await service.summary(h, { organizationId }),
    recent = await service.list(h, { organizationId, pageSize: 5 });
  return (
    <PreSalesOverview
      name={access.user.name}
      directory={JSON.parse(JSON.stringify(directory))}
      summary={summary}
      recent={JSON.parse(JSON.stringify(recent))}
      organizationId={organizationId}
    />
  );
}
