import { headers } from "next/headers";
import { requireAccess } from "@/lib/auth/server";
import { getHelpService } from "@/lib/help-tickets";
import { HelpSettings } from "@/features/help-tickets/settings";
export const dynamic = "force-dynamic";
export const metadata = { title: "Help Ticket Settings" };
export default async function Page() {
  await requireAccess();
  const d = await getHelpService().directory(await headers());
  const companies = d.companies.filter((x) => d.adminOrganizations.includes(x.id));
  return companies.length ? <HelpSettings companies={companies} /> : <p>Admin access required.</p>;
}
