import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CircleDashed, Layers3 } from "lucide-react";
import { modules } from "@/lib/navigation";
import { glassActivities, postSalesStages, preSalesStages } from "@/lib/domain/workflows";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth/server";
import { hasPermission } from "@/lib/auth/access";
import { modulePermission } from "@/lib/auth/roles";

type Props = { params: Promise<{ module: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { module } = await params;
  return { title: modules.find((m) => m.slug === module)?.title ?? "Not found" };
}
export default async function ModulePage({ params }: Props) {
  const { module } = await params;
  const entry = modules.find((m) => m.slug === module);
  if (!entry) notFound();
  const access = await requireAccess();
  if (
    !access.assignments.some((a) =>
      hasPermission(access, a.organizationId, modulePermission[module]),
    )
  ) {
    return (
      <section className="rounded-xl border bg-white p-8">
        <h1 className="text-2xl font-semibold">Access restricted</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your role does not include this module. Contact your administrator.
        </p>
      </section>
    );
  }
  const stages = module === "leads" ? preSalesStages : module === "orders" ? postSalesStages : null;
  return (
    <div className="space-y-7">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
          {entry.group}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{entry.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{entry.description}</p>
      </div>
      <section className="flex min-h-96 flex-col items-center justify-center rounded-2xl border bg-white px-6 py-14 text-center">
        <span className="mb-5 rounded-2xl bg-accent p-5 text-primary">
          <Layers3 size={30} strokeWidth={1.4} />
        </span>
        <Badge variant="secondary" className="mb-4 text-[10px]">
          Planned module
        </Badge>
        <h2 className="text-xl font-semibold tracking-tight">{entry.empty}</h2>
        <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">{entry.detail}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft size={15} /> Back to overview
            </Link>
          </Button>
          {module !== "settings" && (
            <Button asChild>
              <Link href="/settings">
                Workspace setup <ArrowUpRight size={15} />
              </Link>
            </Button>
          )}
        </div>
      </section>
      {stages && (
        <section className="rounded-xl border bg-white p-6">
          <h2 className="text-sm font-semibold">
            Shared {module === "leads" ? "pre-sales" : "post-sales"} workflow
          </h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Workflow reference for Finesta Home, IBAX and S-Grip. Stage tracking is not active yet.
          </p>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {stages.map((stage, i) => (
              <li
                className="flex items-center gap-3 rounded-lg bg-background p-3 text-xs leading-5"
                key={stage}
              >
                <span className="font-semibold tabular-nums text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {stage}
              </li>
            ))}
          </ol>
        </section>
      )}
      {module === "installations" && (
        <section className="rounded-xl border bg-white p-6">
          <h2 className="text-sm font-semibold">S-Grip · Glass requirements</h2>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            During railing installation, Glass Required will be recorded as Yes or No. If Yes, the
            following activities stay inside the existing order:
          </p>
          <ul className="mt-4 space-y-3">
            {glassActivities.map((activity) => (
              <li key={activity} className="flex items-center gap-2 text-xs">
                <CircleDashed size={16} className="text-primary" />
                {activity}
              </li>
            ))}
          </ul>
        </section>
      )}
      {module === "settings" && (
        <section className="rounded-xl border bg-white p-6">
          <h2 className="text-sm font-semibold">Before your first customer</h2>
          <ul className="mt-4 space-y-3 text-xs leading-6 text-muted-foreground">
            <li>Employee identities are managed internally by authorized administrators.</li>
            <li>
              Account changes, branch assignments and role permissions take effect on the server.
            </li>
            <li>
              Contact your administrator for account access, branch changes or password resets.
            </li>
          </ul>
          <p className="mt-4 text-xs font-medium text-primary">
            Customer and order modules will be enabled in subsequent phases.
          </p>
        </section>
      )}
    </div>
  );
}
