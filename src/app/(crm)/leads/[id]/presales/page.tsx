import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth/server";
import { AccessError } from "@/lib/auth/access";
import { getLeadService } from "@/lib/leads";
import { getPresalesService } from "@/lib/presales";
import { PresalesWorkspace } from "@/features/presales/workspace";
export const metadata = { title: "Pre-sales workspace" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAccess();
  const { id } = await params,
    h = await headers(),
    service = getLeadService();
  const initialLead = await service.detail(h, id).catch((e) => {
    if (e instanceof AccessError && e.status === 404) notFound();
    throw e;
  });
  const initial = await getPresalesService().detail(h, id),
    directory = await service.directory(h),
    tab = (await searchParams).tab;
  return (
    <PresalesWorkspace
      initial={JSON.parse(JSON.stringify(initial))}
      initialLead={JSON.parse(JSON.stringify(initialLead))}
      directory={JSON.parse(JSON.stringify(directory))}
      initialTab={
        ["visits", "quotations", "engagements", "conversion"].includes(tab ?? "") ? tab : undefined
      }
    />
  );
}
