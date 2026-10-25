import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAccess } from "@/lib/auth/server";
import { AccessError } from "@/lib/auth/access";
import { getProductionService } from "@/lib/production";
import { LoadWorkspace } from "@/features/production/workspace";
export const metadata = { title: "Production load detail" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ historyPage?: string }>;
}) {
  await requireAccess();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const detail = await getProductionService()
    .detail(await headers(), id, (await searchParams).historyPage ?? 1)
    .catch((error: unknown) => {
      if (error instanceof AccessError && error.status === 404) notFound();
      throw error;
    });
  return (
    <LoadWorkspace
      key={`${id}-${detail.load.version}`}
      detail={JSON.parse(JSON.stringify(detail))}
    />
  );
}
