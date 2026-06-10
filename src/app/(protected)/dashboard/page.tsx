import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { AnalyticsEmbed } from "@/components/analytics/analytics-embed";
import { QueryPanel } from "@/components/analytics/query-panel";
import { DataSourceNote } from "@/components/analytics/data-source-note";
import { EncoderSummary } from "@/components/dashboard/viewer-summary";

export default async function DashboardPage() {
  const user = (await getSessionUser())!; // layout already guaranteed non-null

  // Three dashboard tiers, keyed off RBAC:
  //  • admin/analyst (analytics:export) → full BI workspace + case query panel
  //  • viewer (analytics:read only)     → aggregate charts only, no query/export
  //  • encoder (no analytics)           → data-entry summary from patient data
  const fullWorkspace = can(user.role, "analytics:export");
  const aggregateOnly = !fullWorkspace && can(user.role, "analytics:read");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Welcome back, {user.name || user.email}. Here is the national surveillance
          overview.
        </p>
      </header>

      {fullWorkspace ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(380px,0.8fr)]">
          <div className="space-y-6">
            <AnalyticsEmbed role={user.role} />
            <DataSourceNote />
          </div>
          <Suspense
            fallback={<div className="h-40 rounded-xl border border-slate-200 bg-white" />}
          >
            <QueryPanel />
          </Suspense>
        </div>
      ) : aggregateOnly ? (
        // Viewer: aggregate charts only (no case-level query, no export).
        <AnalyticsEmbed role={user.role} />
      ) : (
        // Encoder: lightweight data-entry overview.
        <EncoderSummary />
      )}
    </div>
  );
}
