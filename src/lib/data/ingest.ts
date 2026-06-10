import "server-only";

import { fhirSearch } from "@/lib/fhir/mock-source";
import {
  validateEncounters,
  validateObservations,
  validatePatients,
} from "@/lib/fhir/validate";
import {
  toEncounterRecord,
  toObservationRecord,
  toPatientRecord,
} from "@/lib/fhir/transform";
import { COLLECTIONS, upsertMany } from "./repository";
import { ANALYTICS_CASES } from "./analytics-cases";
import { buildAnalyticsCases } from "@/lib/analytics/cases";
import { logger } from "@/lib/logging/logger";

/**
 * The canonical pipeline: FETCH (FHIR) → VALIDATE → TRANSFORM → STORE.
 *
 * Returns a per-resource summary (counts + validation errors) so the caller
 * can surface ingestion health in the Admin Panel.
 */
export interface IngestSummary {
  patients: { fetched: number; stored: number; invalid: number };
  observations: { fetched: number; stored: number; invalid: number };
  encounters: { fetched: number; stored: number; invalid: number };
}

export async function runIngestion(): Promise<IngestSummary> {
  // 1. FETCH (simulated upstream FHIR server → Bundles)
  const patientEntries = fhirSearch("Patient").entry ?? [];
  const obsEntries = fhirSearch("Observation").entry ?? [];
  const encEntries = fhirSearch("Encounter").entry ?? [];

  // 2. VALIDATE (collect, don't throw)
  const vp = validatePatients(patientEntries.map((e) => e.resource));
  const vo = validateObservations(obsEntries.map((e) => e.resource));
  const ve = validateEncounters(encEntries.map((e) => e.resource));

  // 3. TRANSFORM (FHIR → normalized)
  const patients = vp.valid.map(toPatientRecord);
  const observations = vo.valid.map(toObservationRecord);
  const encounters = ve.valid.map(toEncounterRecord);

  // 4. STORE (Firestore upsert) — including the de-identified analytics feed.
  const analyticsCases = buildAnalyticsCases(patients, observations);
  const [storedP, storedO, storedE] = await Promise.all([
    upsertMany(COLLECTIONS.PATIENTS, patients),
    upsertMany(COLLECTIONS.OBSERVATIONS, observations),
    upsertMany(COLLECTIONS.ENCOUNTERS, encounters),
    upsertMany(ANALYTICS_CASES, analyticsCases),
  ]);

  const summary: IngestSummary = {
    patients: { fetched: patientEntries.length, stored: storedP, invalid: vp.errors.length },
    observations: { fetched: obsEntries.length, stored: storedO, invalid: vo.errors.length },
    encounters: { fetched: encEntries.length, stored: storedE, invalid: ve.errors.length },
  };

  logger.info("ingestion_complete", { ...summary });
  return summary;
}
