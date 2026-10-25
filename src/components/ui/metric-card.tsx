import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type MetricTone = "red" | "amber" | "green" | "blue";
export function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "blue",
  solid = false,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: MetricTone;
  solid?: boolean;
}) {
  return (
    <article className="metric-card" data-tone={tone} data-solid={solid}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="metric-label text-[11px] font-semibold uppercase leading-5 tracking-wide">
            {label}
          </h2>
          <p className="mt-3 break-words text-2xl font-semibold leading-tight tabular-nums xl:text-[27px]">
            {value}
          </p>
        </div>
        <span
          className="metric-icon flex size-10 shrink-0 items-center justify-center rounded-lg"
          aria-hidden="true"
        >
          <Icon size={21} strokeWidth={1.8} />
        </span>
      </div>
    </article>
  );
}
