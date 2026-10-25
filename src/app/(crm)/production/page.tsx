import { headers } from "next/headers";
import Link from "next/link";
import { requireAccess } from "@/lib/auth/server";
import { getProductionService } from "@/lib/production";
import { loadFiltersSchema } from "@/lib/production/validation";
import { ProductionDashboard } from "@/features/production/dashboard";
export const metadata = { title: "Production loads" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAccess();
  const parsed = loadFiltersSchema.safeParse(await searchParams);
  if (!parsed.success)
    return (
      <p>
        Invalid production filters.{" "}
        <Link href="/production" className="underline">
          Clear filters
        </Link>
      </p>
    );
  const service = getProductionService(),
    h = await headers(),
    result = await service.list(h, parsed.data),
    planning = parsed.data.orderId ? await service.planning(h, parsed.data.orderId) : undefined;
  return (
    <ProductionDashboard
      result={JSON.parse(JSON.stringify(result))}
      planning={planning ? JSON.parse(JSON.stringify(planning)) : undefined}
    />
  );
}
