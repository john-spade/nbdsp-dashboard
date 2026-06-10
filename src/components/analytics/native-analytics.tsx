"use client";

import { Card, CardTitle, ErrorState, Skeleton } from "@/components/ui/primitives";
import { useMetrics } from "@/lib/api/hooks";
import {
  DefectDonutChart,
  RegionBarChart,
  SexGroupedBarChart,
  TrendAreaChart,
} from "./charts";

/**
 * Native Analytics Module — the real, in-app BI dashboard rendered when no
 * external Looker Studio report is configured (NEXT_PUBLIC_LOOKER_EMBED_URL).
 * Honestly labelled: this is NOT a fake iframe.
 */
export function NativeAnalytics() {
  const { data, isLoading, isError, refetch } = useMetrics();

  return (
    <section className="space-y-5">
      {/* BI-style header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800">Birth Defects Analytics</h2>
            <span className="rounded-full bg-maroon-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
              Native Analytics Module
            </span>
          </div>
          <p className="text-xs text-slate-400">Data source: FHIR ingestion pipeline</p>
        </div>
      </div>

      {isError ? (
        <ErrorState message="Failed to load analytics." onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <Skeleton className="h-10 w-24" />
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* KPI tiles */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Total Cases"
              value={data.totalObservations}
              sub={`${data.totalPatients} patients`}
            />
            <Kpi
              label="New This Month"
              value={data.newThisMonth}
              delta={data.newThisMonth - data.prevMonth}
              sub={`vs ${data.prevMonth} last month`}
            />
            <Kpi
              label="Most Affected Region"
              value={data.mostAffectedRegion?.region ?? "—"}
              small
              sub={
                data.mostAffectedRegion
                  ? `${data.mostAffectedRegion.count} cases`
                  : undefined
              }
            />
            <Kpi
              label="Most Common Defect"
              value={data.mostCommonDefect?.label ?? "—"}
              small
              sub={
                data.mostCommonDefect ? `${data.mostCommonDefect.count} cases` : undefined
              }
            />
          </div>

          {/* Full-width: Cases per Region (room for all 18 regions) */}
          <Card>
            <CardTitle>Cases per Region</CardTitle>
            <RegionBarChart
              data={data.casesByRegion}
              height={Math.max(320, data.casesByRegion.length * 26)}
            />
          </Card>

          {/* 2-col row */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardTitle>Monthly Trend (18 months)</CardTitle>
              <TrendAreaChart data={data.monthlyTrend} />
            </Card>
            <Card>
              <CardTitle>Defect Distribution</CardTitle>
              <DefectDonutChart data={data.defectDistribution} />
            </Card>
          </div>

          {/* 2-col row */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardTitle>Cases by Sex (top defects)</CardTitle>
              <SexGroupedBarChart data={data.casesBySexByDefect} />
            </Card>
            <Card>
              <CardTitle>Case Severity</CardTitle>
              <SeverityPanel data={data.severityBreakdown} />
            </Card>
          </div>

          <p className="text-xs leading-relaxed text-slate-400">
            Native analytics module. Production deployment embeds Looker Studio via
            signed service-account URLs for per-user row-level security (set
            <code className="mx-1 rounded bg-slate-100 px-1">NEXT_PUBLIC_LOOKER_EMBED_URL</code>
            to enable).
          </p>
        </>
      )}
    </section>
  );
}

function SeverityPanel({
  data,
}: {
  data: { severity: string; count: number }[];
}) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const colors: Record<string, string> = {
    severe: "#7b1113",
    moderate: "#e0b13a",
    mild: "#94a3b8",
  };
  return (
    <div className="flex h-[300px] flex-col justify-center gap-5 px-2">
      {data.map((d) => {
        const pct = Math.round((d.count / total) * 100);
        return (
          <div key={d.severity}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium capitalize text-slate-700">{d.severity}</span>
              <span className="text-slate-500">
                {d.count} <span className="text-xs text-slate-400">({pct}%)</span>
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: colors[d.severity] ?? "#94a3b8" }}
              />
            </div>
          </div>
        );
      })}
      <p className="mt-2 text-xs text-slate-400">
        Distribution of reported finding severity across {total} cases.
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  delta,
  small,
}: {
  label: string;
  value: string | number;
  sub?: string;
  delta?: number;
  small?: boolean;
}) {
  const trend =
    delta === undefined || delta === 0
      ? null
      : delta > 0
        ? { arrow: "▲", cls: "text-emerald-600", text: `+${delta}` }
        : { arrow: "▼", cls: "text-red-600", text: `${delta}` };

  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <div className="flex items-baseline gap-2">
        <span
          className={
            small
              ? "text-lg font-bold leading-tight text-maroon-700"
              : "text-3xl font-bold text-maroon-700"
          }
        >
          {value}
        </span>
        {trend && (
          <span className={`text-xs font-semibold ${trend.cls}`}>
            {trend.arrow} {trend.text}
          </span>
        )}
      </div>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </Card>
  );
}
