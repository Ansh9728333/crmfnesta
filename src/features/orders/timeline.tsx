"use client";
import { Button } from "@/components/ui/button";
import { dateTime } from "@/features/leads/utils";
import type { OrderDetail } from "./types";
export function WorkflowTimeline({
  detail,
  busy,
  onPage,
}: {
  detail: OrderDetail;
  busy: boolean;
  onPage: (page: number) => void;
}) {
  return (
    <section className="min-w-0 rounded-xl border bg-white p-5 sm:p-6">
      <h2 className="mb-5 font-semibold">Workflow timeline</h2>
      <ol className="space-y-5 border-l pl-4">
        {detail.events.map((event) => (
          <li key={event.id} className="min-w-0">
            <h3 className="text-sm font-medium">
              Stage {event.number}: {event.action.replaceAll("-", " ")}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {event.actorName} · {dateTime(event.createdAt)}
            </p>
            {event.notes && (
              <p className="mt-2 whitespace-pre-wrap break-words text-xs">{event.notes}</p>
            )}
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-primary">
                View audited status and evidence
              </summary>
              <dl className="mt-3 space-y-3">
                {[
                  ["Before", event.before],
                  ["After", event.after],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <dt className="mb-2 font-medium">{String(label)}</dt>
                    <dd>
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg border bg-background p-3 text-[10px]">
                        {value ? JSON.stringify(value, null, 2) : "No previous record"}
                      </pre>
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          </li>
        ))}
      </ol>
      {!detail.events.length && (
        <p className="text-sm text-muted-foreground">
          The stage timeline starts when the workflow is initialized.
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <Button
          size="sm"
          variant="ghost"
          disabled={busy || detail.historyPage <= 1}
          onClick={() => onPage(detail.historyPage - 1)}
        >
          Newer activity
        </Button>
        <span className="text-xs text-muted-foreground">
          {detail.historyTotal} events · Page {detail.historyPage}
        </span>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy || detail.historyPage * 25 >= detail.historyTotal}
          onClick={() => onPage(detail.historyPage + 1)}
        >
          Older activity
        </Button>
      </div>
    </section>
  );
}
