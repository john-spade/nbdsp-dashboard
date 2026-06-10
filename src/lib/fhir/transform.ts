/**
 * FHIR → Normalized transformation layer.
 *
 * Design rules:
 *  - Never throw on missing/optional fields; degrade to null + sensible
 *    defaults. Surveillance feeds are messy and partial records are common.
 *  - Keep every mapping function pure and individually testable.
 *  - Validate the *shape* with Zod at the boundary (validate.ts), then map.
 */

import type {
  FhirAddress,
  FhirCodeableConcept,
  FhirEncounter,
  FhirHumanName,
  FhirObservation,
  FhirPatient,
} from "./types";
import type {
  EncounterRecord,
  ObservationRecord,
  PatientRecord,
  Sex,
} from "./models";
import { formatCaseId } from "./reference-data";

function nameToString(names?: FhirHumanName[]): string {
  if (!names || names.length === 0) return "Unknown";
  const primary = names.find((n) => n.use === "official") ?? names[0];
  if (primary.text) return primary.text;
  const given = primary.given?.join(" ") ?? "";
  const family = primary.family ?? "";
  const full = `${given} ${family}`.trim();
  return full || "Unknown";
}

function extValue(
  extensions: { url: string; valueString?: string }[] | undefined,
  url: string
): string | undefined {
  return extensions?.find((e) => e.url === url)?.valueString;
}

export function toPatientRecord(fhir: FhirPatient): PatientRecord {
  const addr = pickAddress(fhir.address);
  const primary = fhir.name?.find((n) => n.use === "official") ?? fhir.name?.[0];
  const givenParts = primary?.given ?? [];
  const lastName = primary?.family ?? "";
  const firstName = givenParts[0] ?? "";
  const middleName = givenParts.slice(1).join(" ");

  return {
    id: fhir.id,
    caseId: identifierValue(fhir, "urn:nbdsp:caseid") ?? deriveCaseId(fhir.id),
    mrn:
      identifierValue(fhir, "urn:nbdsp:mrn") ??
      fhir.identifier?.find((i) => i.value)?.value ??
      null,
    lastName,
    firstName,
    middleName,
    fatherName: extValue(fhir.extension, "http://nbdsp.mil/fhir/extension/father-name") ?? null,
    motherName: extValue(fhir.extension, "http://nbdsp.mil/fhir/extension/mother-name") ?? null,
    sex: normalizeSex(fhir.gender),
    birthDate: fhir.birthDate ?? null,
    ageDays: ageInDays(fhir.birthDate),
    region: addr?.state ?? null,
    city: addr?.city ?? null,
    active: fhir.active ?? true,
    lastUpdated: fhir.meta?.lastUpdated ?? null,
  };
}

function pickAddress(addresses?: FhirAddress[]): FhirAddress | undefined {
  if (!addresses || addresses.length === 0) return undefined;
  return addresses.find((a) => a.use === "home") ?? addresses[0];
}

function normalizeSex(gender?: string): Sex {
  if (gender === "male" || gender === "female" || gender === "other") {
    return gender;
  }
  return "unknown";
}

function ageInDays(birthDate?: string): number | null {
  if (!birthDate) return null;
  const born = Date.parse(birthDate);
  if (Number.isNaN(born)) return null;
  return Math.max(0, Math.floor((Date.now() - born) / 86_400_000));
}

function identifierValue(
  fhir: FhirPatient,
  system: string
): string | undefined {
  return fhir.identifier?.find((i) => i.system === system && i.value)?.value;
}

/** Derive a Case ID when the upstream resource lacks one. */
function deriveCaseId(id: string): string {
  const digits = id.replace(/\D/g, "");
  return formatCaseId(digits ? Number(digits) : 0);
}

/** Resolve the first usable coding from a CodeableConcept. */
function firstCoding(concept?: FhirCodeableConcept) {
  return concept?.coding?.find((c) => c.code) ?? concept?.coding?.[0];
}

function conceptLabel(concept?: FhirCodeableConcept, fallback = "Unspecified"): string {
  if (!concept) return fallback;
  const coding = firstCoding(concept);
  return concept.text || coding?.display || coding?.code || fallback;
}

/** "Patient/123" → "123" */
function refId(reference?: string): string | null {
  if (!reference) return null;
  const parts = reference.split("/");
  return parts[parts.length - 1] || null;
}

export function toObservationRecord(fhir: FhirObservation): ObservationRecord {
  const coding = firstCoding(fhir.code);
  const rawValue =
    fhir.valueString ??
    (fhir.valueQuantity
      ? `${fhir.valueQuantity.value ?? ""} ${fhir.valueQuantity.unit ?? ""}`.trim()
      : conceptLabel(fhir.valueCodeableConcept, ""));
  const value = rawValue && rawValue.length > 0 ? rawValue : null;

  const severity =
    fhir.interpretation?.[0]?.text ??
    fhir.interpretation?.[0]?.coding?.[0]?.display ??
    null;

  return {
    id: fhir.id,
    patientId: refId(fhir.subject?.reference) ?? "unknown",
    encounterId: refId(fhir.encounter?.reference),
    status: fhir.status ?? "unknown",
    defectCode: coding?.code ?? null,
    defectSystem: coding?.system ?? null,
    defectLabel: conceptLabel(fhir.code, "Unspecified finding"),
    category: conceptLabel(fhir.category?.[0], null as unknown as string) || null,
    severity,
    effectiveDate: fhir.effectiveDateTime ?? null,
    value,
  };
}

export function toEncounterRecord(fhir: FhirEncounter): EncounterRecord {
  return {
    id: fhir.id,
    patientId: refId(fhir.subject?.reference) ?? "unknown",
    status: fhir.status ?? "unknown",
    type: conceptLabel(fhir.type?.[0], null as unknown as string) || null,
    facility: fhir.serviceProvider?.display ?? null,
    start: fhir.period?.start ?? null,
    end: fhir.period?.end ?? null,
  };
}
