import type {
  AnalyticsCase,
  ObservationRecord,
  PatientRecord,
} from "../fhir/models";

/**
 * Build the de-identified analytics feed (one row per observation/finding),
 * joining each observation to its patient for region / sex / birth month.
 *
 * Pure + dependency-free so it runs in the ingestion pipeline, the Add-Patient
 * handler, and the standalone seed script alike.
 */
export function buildAnalyticsCases(
  patients: PatientRecord[],
  observations: ObservationRecord[]
): AnalyticsCase[] {
  const byId = new Map(patients.map((p) => [p.id, p]));
  return observations.map((o) => {
    const p = byId.get(o.patientId);
    return {
      id: o.id,
      caseId: p?.caseId ?? o.patientId,
      patientId: o.patientId,
      region: p?.region ?? "Unknown",
      defectLabel: o.defectLabel,
      icd10: o.defectCode ?? "",
      sex: p?.sex ?? "unknown",
      birthMonth: p?.birthDate ? p.birthDate.slice(0, 7) : "",
      effectiveDate: o.effectiveDate ?? p?.birthDate ?? "",
      severity: o.severity ?? "",
      status: o.status,
    };
  });
}
