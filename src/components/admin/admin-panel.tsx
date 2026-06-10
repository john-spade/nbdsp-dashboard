"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiSend } from "@/lib/api/client";
import {
  Badge,
  Card,
  CardTitle,
  EmptyState,
  ErrorState,
  Skeleton,
} from "@/components/ui/primitives";
import type { IngestSummary } from "@/lib/data/ingest";

interface AuditRow {
  id: string;
  action: string;
  actorEmail: string | null;
  role: string | null;
  resource?: string;
  createdAt: string | null;
}

export function AdminPanel() {
  const qc = useQueryClient();

  const audit = useQuery({
    queryKey: ["audit"],
    queryFn: () => apiGet<{ entries: AuditRow[] }>("/api/admin/audit?limit=50"),
  });

  const ingest = useMutation({
    mutationFn: () =>
      apiSend<{ ok: boolean; summary: IngestSummary }>("/api/admin/ingest", "POST"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });

  return (
    <div className="space-y-6">
      {/* Ingestion control */}
      <Card>
        <CardTitle>FHIR Ingestion Pipeline</CardTitle>
        <p className="mb-4 text-sm text-slate-500">
          Pull from the FHIR source, validate, transform, and store normalized records.
          Pipeline: <span className="font-medium">Fetch → Validate → Transform → Store</span>.
        </p>
        <button
          onClick={() => ingest.mutate()}
          disabled={ingest.isPending}
          className="rounded-lg bg-maroon-600 px-4 py-2 text-sm font-semibold text-white hover:bg-maroon-700 disabled:opacity-60"
        >
          {ingest.isPending ? "Running ingestion…" : "Run ingestion"}
        </button>

        {ingest.isError && (
          <p className="mt-3 text-sm text-red-600">
            {(ingest.error as Error).message}
          </p>
        )}

        {ingest.data && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(["patients", "observations", "encounters"] as const).map((k) => (
              <div key={k} className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase text-slate-400">{k}</p>
                <p className="text-sm text-slate-700">
                  {ingest.data.summary[k].stored} stored /{" "}
                  {ingest.data.summary[k].fetched} fetched
                </p>
                {ingest.data.summary[k].invalid > 0 && (
                  <p className="text-xs text-amber-600">
                    {ingest.data.summary[k].invalid} invalid
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Audit trail */}
      <Card className="p-0">
        <div className="border-b border-slate-200 px-5 py-4">
          <CardTitle>Security Audit Trail</CardTitle>
        </div>
        {audit.isError ? (
          <div className="p-5">
            <ErrorState message="Failed to load audit log." onRetry={() => audit.refetch()} />
          </div>
        ) : audit.isLoading || !audit.data ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-6" />
            ))}
          </div>
        ) : audit.data.entries.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No audit entries yet" />
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto scroll-thin">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-2.5">Action</th>
                  <th className="px-5 py-2.5">Actor</th>
                  <th className="px-5 py-2.5">Resource</th>
                  <th className="px-5 py-2.5">When</th>
                </tr>
              </thead>
              <tbody>
                {audit.data.entries.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100">
                    <td className="px-5 py-2.5">
                      <Badge tone={toneFor(e.action)}>{e.action}</Badge>
                    </td>
                    <td className="px-5 py-2.5 text-slate-600">
                      {e.actorEmail ?? "—"}{" "}
                      <span className="text-xs text-slate-400">({e.role ?? "?"})</span>
                    </td>
                    <td className="px-5 py-2.5 text-xs text-slate-500">{e.resource ?? "—"}</td>
                    <td className="px-5 py-2.5 text-xs text-slate-400">
                      {e.createdAt ? new Date(e.createdAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function toneFor(action: string): "slate" | "maroon" | "gold" | "green" | "red" {
  if (action.startsWith("iframe.load.ok")) return "green";
  if (action.startsWith("iframe.load.fail")) return "red";
  if (action.startsWith("auth.denied") || action.startsWith("error")) return "red";
  if (action.startsWith("auth")) return "green";
  if (action.startsWith("data.write")) return "maroon";
  if (action.startsWith("perf.webvital")) return "gold";
  return "slate";
}
