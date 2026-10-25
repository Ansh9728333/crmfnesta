import Link from "next/link";
import { headers } from "next/headers";
import { requireAccess } from "@/lib/auth/server";
import { getHelpService } from "@/lib/help-tickets";
import { TicketDetailView } from "@/features/help-tickets/detail";
export const dynamic = "force-dynamic";
export const metadata = { title: "Help Ticket" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireAccess();
  const d = await getHelpService().detail(await headers(), (await params).id);
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link className="text-sm font-semibold text-primary" href="/help-tickets">
        ← All Help Tickets
      </Link>
      <TicketDetailView initial={JSON.parse(JSON.stringify(d))} />
    </div>
  );
}
