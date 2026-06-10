import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import type {
  EncounterRecord,
  ObservationRecord,
  PatientRecord,
} from "@/lib/fhir/models";
import { buildAnalyticsCases } from "@/lib/analytics/cases";
import { ANALYTICS_CASES } from "./analytics-cases";

/**
 * Firestore data-access layer (normalized records only).
 *
 * Collections store the *normalized* shape, not raw FHIR — transformation
 * happens once at ingestion. This keeps reads cheap and the UI decoupled.
 */

const PATIENTS = "patients";
const OBSERVATIONS = "observations";
const ENCOUNTERS = "encounters";

export async function listPatients(limit = 500): Promise<PatientRecord[]> {
  const snap = await adminDb.collection(PATIENTS).limit(limit).get();
  return snap.docs.map((d) => d.data() as PatientRecord);
}

export async function getPatient(id: string): Promise<PatientRecord | null> {
  const doc = await adminDb.collection(PATIENTS).doc(id).get();
  return doc.exists ? (doc.data() as PatientRecord) : null;
}

export async function countPatients(): Promise<number> {
  const snap = await adminDb.collection(PATIENTS).count().get();
  return snap.data().count;
}

export async function listObservations(limit = 2000): Promise<ObservationRecord[]> {
  const snap = await adminDb.collection(OBSERVATIONS).limit(limit).get();
  return snap.docs.map((d) => d.data() as ObservationRecord);
}

export async function listObservationsForPatient(
  patientId: string
): Promise<ObservationRecord[]> {
  const snap = await adminDb
    .collection(OBSERVATIONS)
    .where("patientId", "==", patientId)
    .get();
  return snap.docs.map((d) => d.data() as ObservationRecord);
}

export async function listEncountersForPatient(
  patientId: string
): Promise<EncounterRecord[]> {
  const snap = await adminDb
    .collection(ENCOUNTERS)
    .where("patientId", "==", patientId)
    .get();
  return snap.docs.map((d) => d.data() as EncounterRecord);
}

/** Bulk upsert used by the ingestion pipeline + seed script. */
export async function upsertMany<T extends { id: string }>(
  collection: string,
  records: T[]
): Promise<number> {
  const BATCH_LIMIT = 450;
  let written = 0;
  for (let i = 0; i < records.length; i += BATCH_LIMIT) {
    const batch = adminDb.batch();
    for (const record of records.slice(i, i + BATCH_LIMIT)) {
      batch.set(adminDb.collection(collection).doc(record.id), record, {
        merge: true,
      });
    }
    await batch.commit();
    written += Math.min(BATCH_LIMIT, records.length - i);
  }
  return written;
}

/** Atomically write a new patient and its child observations + encounters. */
export async function createPatientBundle(bundle: {
  patient: PatientRecord;
  observations: ObservationRecord[];
  encounters: EncounterRecord[];
}): Promise<void> {
  const batch = adminDb.batch();
  batch.set(adminDb.collection(PATIENTS).doc(bundle.patient.id), bundle.patient);
  for (const o of bundle.observations) {
    batch.set(adminDb.collection(OBSERVATIONS).doc(o.id), o);
  }
  for (const e of bundle.encounters) {
    batch.set(adminDb.collection(ENCOUNTERS).doc(e.id), e);
  }
  // Keep the de-identified analytics feed in sync (Looker/BigQuery source).
  for (const c of buildAnalyticsCases([bundle.patient], bundle.observations)) {
    batch.set(adminDb.collection(ANALYTICS_CASES).doc(c.id), c);
  }
  await batch.commit();
}

/**
 * Replace an existing patient and all of its child records in one atomic
 * batch. Existing observations / encounters / analytics cases for the patient
 * are deleted and rewritten from the new bundle (deterministic ids keep this
 * stable), so an edit can add or remove findings without orphaning documents.
 *
 * The patient doc is merged (not overwritten) so provenance fields such as
 * `mrn` survive an edit.
 */
export async function updatePatientBundle(bundle: {
  patient: PatientRecord;
  observations: ObservationRecord[];
  encounters: EncounterRecord[];
}): Promise<void> {
  const patientId = bundle.patient.id;

  // Read the existing children first so we can delete the ones not re-written.
  const [oldObs, oldEnc, oldCases] = await Promise.all([
    adminDb.collection(OBSERVATIONS).where("patientId", "==", patientId).get(),
    adminDb.collection(ENCOUNTERS).where("patientId", "==", patientId).get(),
    adminDb.collection(ANALYTICS_CASES).where("patientId", "==", patientId).get(),
  ]);

  const batch = adminDb.batch();
  for (const d of [...oldObs.docs, ...oldEnc.docs, ...oldCases.docs]) {
    batch.delete(d.ref);
  }

  batch.set(adminDb.collection(PATIENTS).doc(patientId), bundle.patient, {
    merge: true,
  });
  for (const o of bundle.observations) {
    batch.set(adminDb.collection(OBSERVATIONS).doc(o.id), o);
  }
  for (const e of bundle.encounters) {
    batch.set(adminDb.collection(ENCOUNTERS).doc(e.id), e);
  }
  for (const c of buildAnalyticsCases([bundle.patient], bundle.observations)) {
    batch.set(adminDb.collection(ANALYTICS_CASES).doc(c.id), c);
  }
  await batch.commit();
}

export const COLLECTIONS = { PATIENTS, OBSERVATIONS, ENCOUNTERS };
