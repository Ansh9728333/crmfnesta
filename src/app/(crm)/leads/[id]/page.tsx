import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth/server";
import { AccessError } from "@/lib/auth/access";
import { getLeadService } from "@/lib/leads";
import { LeadDetailView } from "@/features/leads/lead-detail";
import { z } from "zod";
export const metadata = { title: "Lead details" };
export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAccess();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const service = getLeadService(),
    requestHeaders = await headers();
  const detail = await service.detail(requestHeaders, id).catch((e) => {
    if (e instanceof AccessError && e.status === 404) notFound();
    throw e;
  });
  const directory = await service.directory(requestHeaders);
  return (
    <div className="space-y-5">
      <Link href="/leads" className="text-xs font-semibold text-primary">
        ← Back to sales pipeline
      </Link>
      <LeadDetailView
        key={`${id}-${detail.lead.version}`}
        fullPage
        initial={JSON.parse(JSON.stringify(detail))}
        directory={JSON.parse(JSON.stringify(directory))}
      />
    </div>
  );
}
