import { headers } from "next/headers";
import { requireAccess } from "@/lib/auth/server";
import { eligibleAssignments } from "@/lib/leads/access";
import { getLeadService } from "@/lib/leads";
import { leadFiltersSchema } from "@/lib/leads/validation";
import { LeadWorkspace } from "@/features/leads/lead-workspace";
export const metadata = { title: "Leads & sales pipeline" };
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireAccess();
  if (!eligibleAssignments(access, "leads.read").length)
    return (
      <section>
        <h1 className="text-2xl font-semibold">Access restricted</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your role does not include lead management.
        </p>
      </section>
    );
  const query = await searchParams,
    parsed = leadFiltersSchema.safeParse(query),
    filters = parsed.success ? parsed.data : leadFiltersSchema.parse({}),
    view = query.view === "table" ? "table" : "board",
    service = getLeadService(),
    requestHeaders = await headers();
  const directory = await service.directory(requestHeaders),
    summary = await service.summary(requestHeaders, filters),
    list =
      view === "table"
        ? await service.list(requestHeaders, filters)
        : { rows: [], total: summary.total, page: filters.page, pageSize: filters.pageSize },
    board = view === "board" ? await service.board(requestHeaders, filters) : [];
  return (
    <LeadWorkspace
      key={JSON.stringify([
        filters,
        view,
        summary.total,
        board.map((c) => [c.stage, c.total, c.rows.map((r) => [r.id, r.version])]),
        list.rows.map((r) => [r.id, r.version]),
      ])}
      directory={JSON.parse(JSON.stringify(directory))}
      summary={summary}
      list={JSON.parse(JSON.stringify(list))}
      board={JSON.parse(JSON.stringify(board))}
      filters={filters}
      view={view}
    />
  );
}
