/**
 * FHIR R4 resource interfaces (minimal, surveillance-relevant subset).
 *
 * We intentionally model only the fields the surveillance project consumes,
 * rather than the full HL7 spec, to keep the transformation layer auditable.
 * Reference: https://hl7.org/fhir/R4/
 */

export interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

export interface FhirHumanName {
  use?: string;
  family?: string;
  given?: string[];
  text?: string;
}

export interface FhirAddress {
  use?: string;
  city?: string;
  district?: string;
  state?: string; // we map "region" here for PH context
  postalCode?: string;
  country?: string;
}

export interface FhirReference {
  reference?: string; // e.g. "Patient/123"
  display?: string;
}

export interface FhirQuantity {
  value?: number;
  unit?: string;
  system?: string;
  code?: string;
}

export interface FhirPeriod {
  start?: string;
  end?: string;
}

/** FHIR Patient resource. */
export interface FhirPatient {
  resourceType: "Patient";
  id: string;
  identifier?: { system?: string; value?: string }[];
  active?: boolean;
  name?: FhirHumanName[];
  gender?: "male" | "female" | "other" | "unknown";
  birthDate?: string; // YYYY-MM-DD
  address?: FhirAddress[];
  meta?: { lastUpdated?: string };
  extension?: { url: string; valueString?: string }[];
}

/** FHIR Observation resource (used here for birth-defect findings). */
export interface FhirObservation {
  resourceType: "Observation";
  id: string;
  status: "registered" | "preliminary" | "final" | "amended" | "cancelled";
  category?: FhirCodeableConcept[];
  code: FhirCodeableConcept; // the birth defect / condition coded
  subject: FhirReference; // → Patient
  encounter?: FhirReference; // → Encounter
  effectiveDateTime?: string;
  valueQuantity?: FhirQuantity;
  valueCodeableConcept?: FhirCodeableConcept;
  valueString?: string;
  interpretation?: FhirCodeableConcept[];
}

/** FHIR Encounter resource. */
export interface FhirEncounter {
  resourceType: "Encounter";
  id: string;
  status: "planned" | "arrived" | "in-progress" | "finished" | "cancelled";
  class?: FhirCoding;
  type?: FhirCodeableConcept[];
  subject: FhirReference; // → Patient
  period?: FhirPeriod;
  serviceProvider?: FhirReference;
}

/** A FHIR Bundle as returned by a typical search interaction. */
export interface FhirBundle<T> {
  resourceType: "Bundle";
  type: string;
  total?: number;
  entry?: { resource: T }[];
}
