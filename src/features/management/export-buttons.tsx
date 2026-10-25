"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Filters, Report } from "@/lib/management/validation";
export function ExportButtons({ type, filters }: { type: Report; filters: Filters }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(format: "csv" | "xlsx") {
    setBusy(true);
    setError("");
    try {
      const q = new URLSearchParams({ ...filters, page: "1", format });
      const response = await fetch(`/api/management/reports/${type}/export?${q}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "Export unavailable");
      const blob = await response.blob(),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `siteflow-${type}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void save("csv")}>
          <Download size={14} />
          CSV
        </Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void save("xlsx")}>
          <Download size={14} />
          Excel
        </Button>
      </div>
      {error && (
        <p role="alert" className="max-w-72 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
