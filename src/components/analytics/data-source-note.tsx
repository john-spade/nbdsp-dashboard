import { Card } from "@/components/ui/primitives";

/**
 * "Connect a data source" note — documents the Looker/BigQuery feed seam and
 * links to the export endpoint that a Looker connector or scheduled BigQuery
 * load would consume.
 */
export function DataSourceNote() {
  return (
    <Card className="border-dashed">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-700">Connect a data source</p>
          <p className="mt-1 max-w-2xl text-xs text-slate-500">
            This endpoint is the <strong>Looker / BigQuery feed</strong> — the
            de-identified, one-row-per-case dataset Looker Studio would read.
            Point a Looker Studio connector (or a scheduled BigQuery load) at{" "}
            <code className="rounded bg-slate-100 px-1">/api/analytics/export</code>{" "}
            and set <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_LOOKER_EMBED_URL</code>{" "}
            to go live — no code change.
          </p>
        </div>
        <a
          href="/api/analytics/export?format=csv"
          className="whitespace-nowrap rounded-lg border border-maroon-300 px-4 py-2 text-sm font-semibold text-maroon-700 hover:bg-maroon-50"
        >
          ↓ Download feed (CSV)
        </a>
      </div>
    </Card>
  );
}
