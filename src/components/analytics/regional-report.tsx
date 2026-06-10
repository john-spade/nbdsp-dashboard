"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardTitle, EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { useMetrics } from "@/lib/api/hooks";
import type { RegionStat } from "@/lib/fhir/models";

const MAROON = "#7b1113";
const GOLD = "#e0b13a";

/** Short label for the chart axis (full names are long). */
function shortRegion(name: string): string {
  const m = name.match(/\(([^)]+)\)/);
  if (m && m[1].length <= 10) return m[1];
  return name.replace(/\s*\(.*\)\s*/, "").trim();
}

export function RegionalReport() {
  const { data, isLoading, isError, refetch } = useMetrics();

  if (isError)
    return <ErrorState message="Failed to load the regional report." onRetry={() => refetch()} />;

  if (isLoading || !data)
    return (
      <div className="space-y-4">
        <Card>
          <Skeleton className="h-72 w-full" />
        </Card>
      </div>
    );

  const rows = data.regionalBreakdown;
  const totals = rows.reduce(
    (acc, r) => ({ patients: acc.patients + r.patients, cases: acc.cases + r.cases }),
    { patients: 0, cases: 0 }
  );
  const chartData = rows
    .filter((r) => r.cases > 0)
    .map((r) => ({ region: shortRegion(r.region), full: r.region, cases: r.cases }));

  return (
    <div className="space-y-5">
      {/* Diagram */}
      <Card>
        <CardTitle>Cases by Region</CardTitle>
        {chartData.length === 0 ? (
          <EmptyState title="No regional cases recorded yet" />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 30)}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 12, right: 28, top: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="region"
                tick={{ fontSize: 11 }}
                width={120}
                interval={0}
              />
              <Tooltip
                cursor={{ fill: "#f8e9ea" }}
                formatter={(v) => [v, "Cases"]}
                labelFormatter={(_, p) => p?.[0]?.payload?.full ?? ""}
              />
              <Bar dataKey="cases" name="Cases" fill={MAROON} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Table */}
      <Card className="p-0">
        <div className="border-b border-slate-200 px-5 py-4">
          <CardTitle>Regional Surveillance Summary</CardTitle>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Region</th>
                <th className="px-5 py-3 text-right">Patients</th>
                <th className="px-5 py-3 text-right">Cases</th>
                <th className="px-5 py-3">Most Common Defect</th>
                <th className="px-5 py-3 text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: RegionStat) => (
                <tr key={r.region} className="border-b border-slate-100 hover:bg-maroon-50/40">
                  <td className="px-5 py-3 font-medium text-slate-700">{r.region}</td>
                  <td className="px-5 py-3 text-right text-slate-600">{r.patients}</td>
                  <td className="px-5 py-3 text-right font-semibold text-maroon-700">{r.cases}</td>
                  <td className="px-5 py-3 text-slate-600">
                    {r.topDefect ? (
                      <>
                        {r.topDefect}{" "}
                        <span className="text-xs text-slate-400">({r.topDefectCount})</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.round(r.share * 100)}%`, background: GOLD }}
                        />
                      </div>
                      <span className="w-10 text-xs text-slate-500">
                        {(r.share * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold text-slate-700">
                <td className="px-5 py-3">Total ({rows.length} regions)</td>
                <td className="px-5 py-3 text-right">{totals.patients}</td>
                <td className="px-5 py-3 text-right text-maroon-700">{totals.cases}</td>
                <td className="px-5 py-3"></td>
                <td className="px-5 py-3 text-right">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
