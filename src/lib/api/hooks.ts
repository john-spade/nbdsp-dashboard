"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./client";
import type {
  EncounterRecord,
  ObservationRecord,
  PatientRecord,
  SurveillanceMetrics,
} from "@/lib/fhir/models";

export function useMetrics() {
  return useQuery({
    queryKey: ["metrics"],
    queryFn: () => apiGet<{ metrics: SurveillanceMetrics }>("/api/analytics/metrics"),
    select: (d) => d.metrics,
  });
}

export function usePatients() {
  return useQuery({
    queryKey: ["patients"],
    queryFn: () =>
      apiGet<{ patients: PatientRecord[]; total: number }>("/api/patients"),
  });
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: ["patient", id],
    queryFn: () =>
      apiGet<{
        patient: PatientRecord;
        observations: ObservationRecord[];
        encounters: EncounterRecord[];
      }>(`/api/patients/${id}`),
    enabled: Boolean(id),
  });
}
