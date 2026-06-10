"use client";

import Link from "next/link";
import { Card, CardTitle, EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { usePatients } from "@/lib/api/hooks";

/**
 * Encoder dashboard — a lightweight data-entry overview built from the patient
 * registry (encoders have patient:read but no analytics access). Doubles as the
 * fallback summary for any role without analytics.
 */
export function EncoderSummary() {
  const { data, isLoading, isError, refetch } = usePatients();

  if (isError)
    return <ErrorState message="Failed to load summary." onRetry={() => refetch()} />;

  if (isLoading || !data)
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <Skeleton className="h-8 w-20" />
          </Card>
        ))}
      </div>
    );

  if (data.total === 0)
    return <EmptyState title="No surveillance data yet" hint="Register the first case below." />;

  const regions = new Set(data.patients.map((p) => p.region).filter(Boolean));
  const recent = data.patients.filter(
    (p) => p.ageDays !== null && p.ageDays <= 30
  ).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardTitle>Registered Patients</CardTitle>
          <p className="text-3xl font-bold text-maroon-700">{data.total}</p>
        </Card>
        <Card>
          <CardTitle>Regions Covered</CardTitle>
          <p className="text-3xl font-bold text-maroon-700">{regions.size}</p>
        </Card>
        <Card>
          <CardTitle>Neonatal (≤30 days)</CardTitle>
          <p className="text-3xl font-bold text-maroon-700">{recent}</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/patients/new"
          className="rounded-lg bg-maroon-600 px-4 py-2 text-sm font-semibold text-white hover:bg-maroon-700"
        >
          + Add Patient
        </Link>
        <Link
          href="/patients"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-maroon-400 hover:text-maroon-700"
        >
          View Patients
        </Link>
      </div>
    </div>
  );
}
