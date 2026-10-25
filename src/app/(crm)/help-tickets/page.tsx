import { headers } from "next/headers";
import { requireAccess } from "@/lib/auth/server";
import { getHelpService } from "@/lib/help-tickets";
import { HelpDashboard } from "@/features/help-tickets/dashboard";
export const dynamic = "force-dynamic";
export const metadata = { title: "Help Tickets" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAccess();
  const q = await searchParams,
    h = await headers(),
    s = getHelpService();
  const d = await s.directory(h, q.sourceId ? { kind: q.kind, id: q.sourceId } : undefined),
    data = await s.list(h, q);
  return (
    <HelpDashboard
      query={q}
      directory={JSON.parse(JSON.stringify(d))}
      data={JSON.parse(JSON.stringify(data))}
    />
  );
}
