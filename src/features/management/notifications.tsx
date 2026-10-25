"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestJson, dateTime } from "@/features/leads/utils";
import type { Notifications } from "./types";
export function NotificationBell() {
  const [unread, setUnread] = useState<number | null>(null);
  const pathname = usePathname();
  useEffect(() => {
    let alive = true;
    async function update() {
      if (document.visibilityState === "hidden") return;
      try {
        const r = await requestJson<{ unread: number }>("/api/notifications?unread=yes&mode=count");
        if (alive) setUnread(r.unread);
      } catch {
        if (alive) setUnread(null);
      }
    }
    void update();
    window.addEventListener("siteflow-notifications-updated", update);
    const timer = window.setInterval(() => void update(), 60000);
    document.addEventListener("visibilitychange", update);
    return () => {
      alive = false;
      window.removeEventListener("siteflow-notifications-updated", update);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, [pathname]);
  return (
    <Link
      href="/notifications"
      prefetch={false}
      className="inline-flex items-center gap-2 rounded-md px-2 py-2 text-xs hover:bg-muted"
      aria-label={unread === null ? "Notifications" : `Notifications, ${unread} unread`}
    >
      <Bell size={16} />
      <span className="hidden sm:inline">Notifications</span>
      {unread !== null && unread > 0 && (
        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-white">{unread}</span>
      )}
    </Link>
  );
}
export function NotificationCenter({ data: d, unread }: { data: Notifications; unread: string }) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [pending, startTransition] = useTransition(),
    [error, setError] = useState("");
  async function change(row: Notifications["rows"][number], state: "read" | "dismissed") {
    setBusy(true);
    setError("");
    try {
      await requestJson("/api/notifications", "PATCH", {
        kind: row.kind,
        entityId: row.entity_id,
        dueAt: row.due_at,
        state,
      });
      window.dispatchEvent(new Event("siteflow-notifications-updated"));
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const href = (page: number) =>
    `/notifications?${new URLSearchParams({ unread, page: String(page) })}`;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Your attention, where it matters
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Notifications</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Overdue follow-ups, production, contractual payments, installation and audit tasks. Alerts
          resolve when their source work is completed.
        </p>
      </header>
      <form className="flex items-center gap-4 rounded-xl border bg-white p-4">
        <label className="flex items-center gap-2 text-sm">
          <input name="unread" value="yes" type="checkbox" defaultChecked={unread === "yes"} />
          Unread only
        </label>
        <Button variant="outline" size="sm">
          Apply
        </Button>
        <p className="text-xs text-muted-foreground">
          {d.unread} unread · {d.total} matching alerts
        </p>
      </form>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="space-y-3">
        {d.rows.map((row) => (
          <article
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-5"
            key={`${row.kind}-${row.entity_id}`}
          >
            <div>
              <h2 className="text-sm font-semibold">{row.title}</h2>
              <p className="mt-2 text-sm">{row.client}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Due {dateTime(row.due_at)} · {row.state === "read" ? "Read" : "Unread"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link className="text-sm font-medium underline" href={row.href}>
                Open record
              </Link>
              {row.state !== "read" && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || pending}
                  onClick={() => void change(row, "read")}
                >
                  Mark read
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                disabled={busy || pending}
                onClick={() => void change(row, "dismissed")}
              >
                Dismiss
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!d.rows.length && (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <h2 className="font-semibold">No matching overdue tasks</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Only recorded due dates and your current permissions are used. Missing target dates are
            not assumed overdue.
          </p>
        </div>
      )}
      <nav aria-label="Notification pagination" className="flex justify-between text-sm">
        {d.page > 1 ? <Link href={href(d.page - 1)}>Previous</Link> : <span />}
        <span>Page {d.page}</span>
        {d.page * 20 < d.total ? <Link href={href(d.page + 1)}>Next</Link> : <span />}
      </nav>
    </div>
  );
}
