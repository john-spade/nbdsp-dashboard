"use client";

import { use } from "react";
import Link from "next/link";
import { usePatient } from "@/lib/api/hooks";
import { useSession } from "@/components/auth/session-context";
import { can } from "@/lib/auth/rbac";
import {
  Badge,
  Card,
  CardTitle,
  EmptyState,
  ErrorState,
  Skeleton,
} from "@/components/ui/primitives";

export default function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading, isError, refetch } = usePatient(id);
  const { role } = useSession();
  const canEdit = can(role, "patient:edit");

  return (
    <div className="space-y-5">
      <Link href="/patients" className="text-sm text-maroon-600 hover:underline">
        ← Back to patients
      </Link>

      {isError ? (
        <ErrorState message="Could not load patient." onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <Card>
          <Skeleton className="mb-3 h-6 w-48" />
          <Skeleton className="h-4 w-full" />
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-maroon-700">
                  {data.patient.caseId}
                </h1>
                <p className="mt-1 text-sm font-medium text-slate-600">
                  {data.patient.lastName}, {data.patient.firstName}
                  {data.patient.middleName ? ` ${data.patient.middleName}` : ""}
                </p>
                <p className="text-xs text-slate-500">
                  {data.patient.region ?? "Unknown region"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {canEdit && (
                  <Link
                    href={`/patients/${id}/edit`}
                    className="rounded-lg bg-maroon-600 px-4 py-2 text-sm font-semibold text-white hover:bg-maroon-700"
                  >
                    Edit
                  </Link>
                )}
                <Badge tone={data.patient.active ? "green" : "slate"}>
                  {data.patient.active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Sex" value={data.patient.sex} />
              <Field label="Birth date" value={data.patient.birthDate ?? "—"} />
              <Field
                label="Age"
                value={
                  data.patient.ageDays !== null ? `${data.patient.ageDays} days` : "—"
                }
              />
              <Field
                label="City / facility"
                value={data.patient.city || data.patient.region || "—"}
              />
              <Field label="Father's name" value={data.patient.fatherName ?? "—"} />
              <Field label="Mother's name" value={data.patient.motherName ?? "—"} />
            </dl>
          </Card>

          <Card>
            <CardTitle>Observations (Birth Defect Findings)</CardTitle>
            {data.observations.length === 0 ? (
              <EmptyState title="No observations recorded" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.observations.map((o) => (
                  <li key={o.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{o.defectLabel}</p>
                      <p className="text-xs text-slate-400">
                        {o.defectCode ?? "no code"} · {o.category ?? "uncategorized"} ·{" "}
                        {o.effectiveDate ?? "no date"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {o.severity && (
                        <Badge
                          tone={
                            o.severity === "severe"
                              ? "red"
                              : o.severity === "moderate"
                                ? "gold"
                                : "slate"
                          }
                        >
                          {o.severity}
                        </Badge>
                      )}
                      <Badge tone={o.status === "final" ? "maroon" : "slate"}>
                        {o.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle>Encounters</CardTitle>
            {data.encounters.length === 0 ? (
              <EmptyState title="No encounters recorded" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.encounters.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {e.type ?? "Encounter"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {e.facility ?? "—"} · {e.start ?? "no date"}
                      </p>
                    </div>
                    <Badge>{e.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium capitalize text-slate-700">{value}</dd>
    </div>
  );
}
