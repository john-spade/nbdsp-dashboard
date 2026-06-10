import "server-only";

import {
  toEncounterRecord,
  toObservationRecord,
  toPatientRecord,
} from "@/lib/fhir/transform";
import { facilityFor, REGION_CITY } from "@/lib/fhir/reference-data";
import type {
  FhirEncounter,
  FhirObservation,
  FhirPatient,
} from "@/lib/fhir/types";
import type {
  EncounterRecord,
  ObservationRecord,
  PatientRecord,
} from "@/lib/fhir/models";
import type { CreatePatientInput } from "@/lib/fhir/validate";

export interface PatientBundle {
  patient: PatientRecord;
  observations: ObservationRecord[];
  encounters: EncounterRecord[];
}

/**
 * Assemble FHIR resources from the operator form payload and run them through
 * the same transform layer used by ingestion, producing normalized records.
 *
 * Deterministic ids (keyed off the Case ID) so that editing a case overwrites
 * its existing child documents instead of orphaning them. Shared by both the
 * create (POST) and edit (PATCH) handlers.
 */
export function assemblePatientBundle(
  input: CreatePatientInput,
  caseId: string
): PatientBundle {
  const city = input.city?.trim() || REGION_CITY[input.region] || input.region;
  const facility = input.encounter.facility?.trim() || facilityFor(input.region);
  const encounterId = `E-${caseId}`;

  const fhirPatient: FhirPatient = {
    resourceType: "Patient",
    id: caseId,
    identifier: [{ system: "urn:nbdsp:caseid", value: caseId }],
    active: true,
    name: [
      {
        use: "official",
        family: input.lastName,
        given: [input.firstName, input.middleName].filter(Boolean) as string[],
      },
    ],
    gender: input.sex,
    birthDate: input.birthDate,
    address: [{ use: "home", state: input.region, city, country: "PH" }],
    meta: { lastUpdated: new Date().toISOString() },
    extension: [
      ...(input.fatherName ? [{ url: "http://nbdsp.mil/fhir/extension/father-name", valueString: input.fatherName }] : []),
      ...(input.motherName ? [{ url: "http://nbdsp.mil/fhir/extension/mother-name", valueString: input.motherName }] : []),
    ],
  };

  const fhirObservations: FhirObservation[] = input.observations.map((o, i) => ({
    resourceType: "Observation",
    id: `O-${caseId}-${i}`,
    status: "final",
    category: [{ text: "Birth defect" }],
    code: {
      coding: o.code
        ? [{ system: "http://hl7.org/fhir/sid/icd-10", code: o.code, display: o.defectLabel }]
        : [],
      text: o.defectLabel,
    },
    subject: { reference: `Patient/${caseId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    effectiveDateTime: o.recordedDate,
    interpretation: [{ text: o.severity }],
    valueString: "confirmed",
  }));

  const fhirEncounter: FhirEncounter = {
    resourceType: "Encounter",
    id: encounterId,
    status: input.encounter.status,
    type: [{ text: input.encounter.type }],
    subject: { reference: `Patient/${caseId}` },
    period: { start: input.encounter.date },
    serviceProvider: { display: facility },
  };

  return {
    patient: toPatientRecord(fhirPatient),
    observations: fhirObservations.map(toObservationRecord),
    encounters: [toEncounterRecord(fhirEncounter)],
  };
}

/** Patient demographic fields surfaced in the edit form (for audit diffing). */
const DEMOGRAPHIC_FIELDS = [
  "lastName",
  "firstName",
  "middleName",
  "fatherName",
  "motherName",
  "sex",
  "birthDate",
  "region",
  "city",
] as const;

/** Names of demographic fields whose value differs between two patient records. */
export function changedPatientFields(
  before: PatientRecord,
  after: PatientRecord
): string[] {
  return DEMOGRAPHIC_FIELDS.filter((f) => before[f] !== after[f]);
}
