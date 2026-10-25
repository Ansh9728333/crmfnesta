import { headers } from "next/headers";
import { requireAccess } from "@/lib/auth/server";
import { adminOrganizations } from "@/lib/auth/access";
import { getSettingsService } from "@/lib/management";
import { AdminSettings } from "@/features/management/settings";
export const metadata = { title: "Admin Panel" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const a = await requireAccess();
  if (!adminOrganizations(a).length)
    return (
      <section>
        <h1 className="text-2xl font-semibold">Access restricted</h1>
        <p className="mt-3 text-sm">Only company administrators manage these settings.</p>
      </section>
    );
  const d = await getSettingsService().list(await headers(), await searchParams);
  return (
    <AdminSettings
      key={`${d.filters.kind}-${d.filters.organizationId}-${d.rows.map((r) => r.version).join("-")}`}
      data={JSON.parse(JSON.stringify(d))}
    />
  );
}
