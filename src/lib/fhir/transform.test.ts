import { describe, expect, it } from "vitest";
import {
  toEncounterRecord,
  toObservationRecord,
  toPatientRecord,
} from "./transform";
import type { FhirEncounter, FhirObservation, FhirPatient } from "./types";

describe("toPatientRecord", () => {
  it("maps a complete Patient resource", () => {
    const fhir: FhirPatient = {
      resourceType: "Patient",
      id: "P1",
      identifier: [{ system: "urn:nbdsp:mrn", value: "MRN-1" }],
      active: true,
      name: [{ use: "official", family: "Cruz", given: ["Baby", "Juan"] }],
      gender: "male",
      birthDate: "2020-01-01",
      address: [{ use: "home", state: "NCR", city: "Manila" }],
      meta: { lastUpdated: "2024-01-01T00:00:00Z" },
    };
    const r = toPatientRecord(fhir);
    expect(r.mrn).toBe("MRN-1");
    expect(r.lastName).toBe("Cruz");
    expect(r.firstName).toBe("Baby");
    expect(r.middleName).toBe("Juan");
    expect(r.sex).toBe("male");
    expect(r.region).toBe("NCR");
    expect(r.city).toBe("Manila");
    expect(r.ageDays).toBeGreaterThan(0);
  });

  it("degrades gracefully on missing optional fields", () => {
    const r = toPatientRecord({ resourceType: "Patient", id: "P2" });
    expect(r.lastName).toBe("");
    expect(r.firstName).toBe("");
    expect(r.middleName).toBe("");
    expect(r.sex).toBe("unknown");
    expect(r.region).toBeNull();
    expect(r.birthDate).toBeNull();
    expect(r.ageDays).toBeNull();
    expect(r.active).toBe(true); // default
  });

  it("normalizes an invalid gender to 'unknown'", () => {
    const r = toPatientRecord({
      resourceType: "Patient",
      id: "P3",
      gender: "weird" as never,
    });
    expect(r.sex).toBe("unknown");
  });
});

describe("toObservationRecord", () => {
  it("extracts ICD-10 coding and resolves the patient reference", () => {
    const fhir: FhirObservation = {
      resourceType: "Observation",
      id: "O1",
      status: "final",
      category: [{ text: "Congenital heart defect" }],
      code: {
        coding: [
          { system: "http://hl7.org/fhir/sid/icd-10", code: "Q21.0", display: "VSD" },
        ],
        text: "Ventricular septal defect",
      },
      subject: { reference: "Patient/P1" },
      encounter: { reference: "Encounter/EP1" },
      effectiveDateTime: "2020-01-02",
      valueString: "confirmed",
    };
    const r = toObservationRecord(fhir);
    expect(r.patientId).toBe("P1");
    expect(r.encounterId).toBe("EP1");
    expect(r.defectCode).toBe("Q21.0");
    expect(r.defectLabel).toBe("Ventricular septal defect");
    expect(r.category).toBe("Congenital heart defect");
    expect(r.value).toBe("confirmed");
  });

  it("falls back when subject reference and value are absent", () => {
    const r = toObservationRecord({
      resourceType: "Observation",
      id: "O2",
      status: "final",
      code: { text: "Cleft palate" },
      subject: {},
    });
    expect(r.patientId).toBe("unknown");
    expect(r.encounterId).toBeNull();
    expect(r.defectCode).toBeNull();
    expect(r.value).toBeNull();
  });

  it("formats a valueQuantity", () => {
    const r = toObservationRecord({
      resourceType: "Observation",
      id: "O3",
      status: "final",
      code: { text: "Head circumference" },
      subject: { reference: "Patient/P9" },
      valueQuantity: { value: 33, unit: "cm" },
    });
    expect(r.value).toBe("33 cm");
  });
});

describe("toEncounterRecord", () => {
  it("maps facility and period", () => {
    const fhir: FhirEncounter = {
      resourceType: "Encounter",
      id: "E1",
      status: "finished",
      type: [{ text: "Newborn screening" }],
      subject: { reference: "Patient/P1" },
      period: { start: "2020-01-01", end: "2020-01-03" },
      serviceProvider: { display: "NCR Medical Center" },
    };
    const r = toEncounterRecord(fhir);
    expect(r.patientId).toBe("P1");
    expect(r.type).toBe("Newborn screening");
    expect(r.facility).toBe("NCR Medical Center");
    expect(r.start).toBe("2020-01-01");
    expect(r.end).toBe("2020-01-03");
  });
});
