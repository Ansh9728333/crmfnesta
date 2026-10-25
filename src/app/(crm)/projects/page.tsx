import { headers } from "next/headers";
import { requireAccess } from "@/lib/auth/server";
import { eligibleAssignments } from "@/lib/leads/access";
import { getLeadService } from "@/lib/leads";
import { ParentWorkspace } from "@/features/leads/parent-workspace";
import { leadFiltersSchema } from "@/lib/leads/validation";
export const metadata = { title: "Projects" };
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const access = await requireAccess();
  if (!eligibleAssignments(access, "leads.read").length) return <h1>Access restricted</h1>;
  const query = await searchParams,
    parsed = leadFiltersSchema.safeParse(query),
    filters = parsed.success ? parsed.data : leadFiltersSchema.parse({}),
    service = getLeadService(),
    h = await headers(),
    directory = await service.directory(h),
    initial = await service.projects(h, filters);
  return (
    <ParentWorkspace
      key={JSON.stringify(query)}
      kind="projects"
      query={query}
      initial={JSON.parse(JSON.stringify(initial))}
      directory={JSON.parse(JSON.stringify(directory))}
    />
  );
}
