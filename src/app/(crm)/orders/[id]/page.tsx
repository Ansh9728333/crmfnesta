import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getOrderService } from "@/lib/orders";
import { requireAccess } from "@/lib/auth/server";
import { AccessError } from "@/lib/auth/access";
import { OrderWorkspace } from "@/features/orders/workspace";
export const metadata = { title: "Order workflow" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ stage?: string }>;
}) {
  await requireAccess();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const stage = z.coerce
      .number()
      .int()
      .min(1)
      .max(16)
      .safeParse((await searchParams).stage),
    detail = await getOrderService()
      .detail(await headers(), id, stage.success ? { fileStage: stage.data } : {})
      .catch((e) => {
        if (e instanceof AccessError && e.status === 404) notFound();
        throw e;
      });
  return <OrderWorkspace initial={JSON.parse(JSON.stringify(detail))} />;
}
