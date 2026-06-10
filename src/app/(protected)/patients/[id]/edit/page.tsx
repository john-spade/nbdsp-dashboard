"use client";

import { use } from "react";
import Link from "next/link";
import { usePatient } from "@/lib/api/hooks";
import { Card, ErrorState, Skeleton } from "@/components/ui/primitives";
import { PatientForm, toFormValues } from "@/components/patients/patient-form";

/**
 * Edit Patient — admin + encoder only (guarded by the protected layout + the
 * PATCH handler). Same form as "Add Patient", pre-filled from the record.
 */
export default function EditPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading, isError, refetch } = usePatient(id);

  if (isError)
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href={`/patients/${id}`} className="text-sm text-maroon-600 hover:underline">
          ← Back
        </Link>
        <ErrorState message="Could not load this patient." onRetry={() => refetch()} />
      </div>
    );

  if (isLoading || !data)
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <Skeleton className="mb-3 h-6 w-48" />
          <Skeleton className="h-4 w-full" />
        </Card>
      </div>
    );

  return (
    <PatientForm
      mode="edit"
      patientId={id}
      initial={toFormValues(data.patient, data.observations, data.encounters)}
    />
  );
}
