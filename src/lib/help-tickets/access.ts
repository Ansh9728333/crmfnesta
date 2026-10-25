import { and, eq, or, sql } from "drizzle-orm";
import type { Access } from "../auth/access";
import { adminOrganizations } from "../auth/access";
import { eligibleAssignments } from "../leads/access";
import { helpTickets } from "../db/schema";
export function helpScope(a: Access) {
  return (
    or(
      ...eligibleAssignments(a, "help.read").map((x) =>
        and(
          eq(helpTickets.organizationId, x.organizationId),
          adminOrganizations(a).includes(x.organizationId)
            ? undefined
            : and(
                eq(helpTickets.centreId, x.centreId),
                or(eq(helpTickets.createdBy, a.user.id), eq(helpTickets.assignedTo, a.user.id)),
              ),
        ),
      ),
    ) ?? sql`false`
  );
}
export function helpTaskSource(a: Access) {
  const canResolve =
    or(
      ...eligibleAssignments(a, "help.resolve").map((x) =>
        and(
          eq(helpTickets.organizationId, x.organizationId),
          adminOrganizations(a).includes(x.organizationId)
            ? undefined
            : eq(helpTickets.centreId, x.centreId),
        ),
      ),
    ) ?? sql`false`;
  return sql`select help_tickets.organization_id,help_tickets.id as entity_id,'help_ticket'::text as kind,
    case when help_tickets.status='awaiting_confirmation' then 'Confirm ticket resolution' when help_tickets.due_at<now() then 'Help ticket overdue' when help_tickets.status='reopened' then 'Help ticket reopened' else 'Help ticket assigned' end::text as title,
    c.name as client,'/help-tickets/'||help_tickets.id as href,date_trunc('milliseconds',case when help_tickets.due_at<now() then greatest(help_tickets.updated_at,help_tickets.due_at) else help_tickets.updated_at end) as due_at
    from help_tickets join customers c on c.id=help_tickets.customer_id and c.organization_id=help_tickets.organization_id
    where ${helpScope(a)} and ((help_tickets.assigned_to=${a.user.id} and ${canResolve} and help_tickets.status in ('raised','in_progress','reopened'))
    or (help_tickets.created_by=${a.user.id} and help_tickets.resolved_by<>${a.user.id} and help_tickets.status='awaiting_confirmation')
    or (help_tickets.created_by=help_tickets.assigned_to and help_tickets.status='awaiting_confirmation' and help_tickets.organization_id in (${
      adminOrganizations(a).length
        ? sql.join(
            adminOrganizations(a).map((x) => sql`${x}::uuid`),
            sql`, `,
          )
        : sql`null::uuid`
    }) and help_tickets.resolved_by<>${a.user.id}))`;
}
