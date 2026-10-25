import type { Permission } from "@/lib/auth/roles";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { eligibleAssignments } from "@/lib/leads/access";
import { requireAccess } from "@/lib/auth/server";
import { AccessError } from "@/lib/auth/access";
import { getCommerceService } from "@/lib/commerce";
import { commerceFilters } from "@/lib/commerce/validation";
import { CommerceDashboard } from "./dashboard";
import { CommerceWorkspace } from "./workspace";
export async function CommercePage({
  searchParams,
  mode,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
  mode: "payments" | "dispatch";
}) {
  const access = await requireAccess();
  const query = await searchParams;
  const allowed = query.orderId
    ? [
        "payments.manage",
        "production.manage",
        "orders.manage",
        "installations.manage",
        "audits.manage",
      ].some((p) => eligibleAssignments(access, p as Permission).length > 0)
    : eligibleAssignments(access, mode === "payments" ? "payments.manage" : "production.manage")
        .length > 0;
  if (!allowed)
    return (
      <section>
        <h1 className="text-2xl font-semibold">Access restricted</h1>
        <p className="mt-3 text-sm">
          Your role does not include this financial or shipping workspace.
        </p>
      </section>
    );
  const h = await headers(),
    service = getCommerceService();
  if (query.orderId) {
    if (!z.uuid().safeParse(query.orderId).success) notFound();
    const detail = await service
      .detail(h, query.orderId, query.historyPage ?? 1)
      .catch((e: unknown) => {
        if (e instanceof AccessError && e.status === 404) notFound();
        throw e;
      });
    return (
      <CommerceWorkspace
        key={`${detail.order.id}-${detail.events[0]?.id ?? "empty"}`}
        detail={JSON.parse(JSON.stringify(detail))}
        mode={mode}
      />
    );
  }
  const filters = commerceFilters.safeParse(query);
  if (!filters.success)
    return (
      <p>
        Invalid filters.{" "}
        <Link href={`/${mode}`} className="underline">
          Clear filters
        </Link>
      </p>
    );
  const result = await service.list(h, mode, filters.data);
  return <CommerceDashboard result={JSON.parse(JSON.stringify(result))} mode={mode} />;
}
