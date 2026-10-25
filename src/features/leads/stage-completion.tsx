"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { preSalesStages } from "@/lib/domain/workflows";
import { requestJson } from "./utils";

const instructions = [
  "Confirm the client, mobile, company, project and assigned executive are correct.",
  "Save the site visit appointment date, time and assigned employee in Visits first.",
  "Complete the site visit with site observations and initial measurements in Visits first.",
  "Issue the item-wise quotation in Quotations first. Historical revisions are preserved.",
  "Record the showroom outcome, or Not Required with a reason, in Showroom & negotiation first.",
];

export function StageCompletion({
  lead,
  onCompleted,
  onNavigate,
}: {
  lead: { id: string; stage: number; version: number; clientName: string | null };
  onCompleted?: () => void | Promise<void>;
  onNavigate?: (tab: string) => void;
}) {
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (lead.stage >= 6)
    return (
      <Button asChild size="sm" variant="outline">
        <Link
          href={`/leads/${lead.id}/presales?tab=conversion`}
          onClick={(event) => {
            if (onNavigate) {
              event.preventDefault();
              onNavigate("conversion");
            }
          }}
        >
          Done · confirm Won / Lost
        </Link>
      </Button>
    );
  return (
    <>
      <Button
        ref={trigger}
        size="sm"
        variant="outline"
        aria-label={`Done ${lead.clientName}`}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        <CheckCircle2 size={14} /> Done
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <DialogTitle>Mark current step Done</DialogTitle>
          <DialogDescription>
            {lead.clientName} · {preSalesStages[lead.stage - 1]}
          </DialogDescription>
          <p className="text-sm">{instructions[lead.stage - 1]}</p>
          <p className="text-sm">
            Done will automatically start the next step:{" "}
            <strong>{preSalesStages[lead.stage]}</strong>.
          </p>
          <p className="text-xs text-muted-foreground">
            Completion, employee and time are saved in the activity history. Steps cannot be
            selected or skipped.
          </p>
          <Button asChild variant="ghost">
            <Link
              href={`/leads/${lead.id}/presales?tab=${lead.stage === 4 ? "quotations" : lead.stage === 5 ? "engagements" : "visits"}`}
              onClick={(event) => {
                if (onNavigate) {
                  event.preventDefault();
                  setOpen(false);
                  onNavigate(
                    lead.stage === 4 ? "quotations" : lead.stage === 5 ? "engagements" : "visits",
                  );
                }
              }}
            >
              Open step details
            </Link>
          </Button>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await requestJson(`/api/leads/${lead.id}/presales`, "POST", {
                  action: "complete-stage",
                  data: { stage: lead.stage, version: lead.version },
                });
                await onCompleted?.();
                setOpen(false);
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Unable to complete this step");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving…" : "Done · start next step"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
