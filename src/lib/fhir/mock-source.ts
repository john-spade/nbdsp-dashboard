/**
 * Simulated upstream FHIR R4 server.
 *
 * In production this module would be replaced by a real HTTP client pointed
 * at a hospital FHIR endpoint. Here it deterministically generates realistic
 * Philippine birth-defects surveillance data so the whole pipeline
 * (fetch → validate → transform → store) is exercisable end-to-end.
 */
import type {
  FhirBundle,
  FhirEncounter,
  FhirObservation,
  FhirPatient,
} from "./types";
import {
  DEFECTS,
  PH_REGIONS,
  REGION_CITY,
  SEVERITIES,
  facilityFor,
  formatCaseId,
} from "./reference-data";

// Deterministic pseudo-random so seeds/exports are reproducible.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FILIPINO_FIRST_NAMES = [
  "Maria", "Jose", "Juan", "Ana", "Pedro", "Maria Clara", "Andres", "Luz", "Carlos", "Carmen",
  "Miguel", "Teresa", "Francisco", "Rosa", "Antonio", "Elena", "Luis", "Mercedes", "Pablo", "Nina",
  "Gabriel", "Sofia", "Raymond", "Angela", "Justin", "Diana", "Bryan", "Camille", "Kyle", "Jessa",
  "Joshua", "Katherine", "Mark", "Paula", "Ronald", "Michelle", "Dennis", "Sharon", "Edward", "Rita",
  "Ricardo", "Lilia", "Bernardo", "Gloria", "Roberto", "Patricia", "Fernando", "Marissa", "Alfredo", "Virginia",
];

const FILIPINO_MIDDLE_NAMES = [
  "Santos", "Cruz", "Reyes", "Bautista", "Mendoza", "Garcia", "Lopez", "Gonzales", "Del Pilar", "Macapagal",
  "Marquez", "Rivera", "Santiago", "Flores", "Diaz", "Ramirez", "Vargas", "Torres", "Gomez", "Morales",
];

const FILIPINO_SURNAMES = [
  "Santos", "Cruz", "Mendoza", "Bautista", "Reyes", "Garcia", "Lopez", "Gonzales", "Del Rosario", "Martin",
  "Rodriguez", "Mercedes", "Enriquez", "Villanueva", "Aquino", "Magbalon", "Francisco", "Mabini", "Bonifacio", "Rizal",
  "Santiago", "Flores", "Diaz", "Ramirez", "Vargas", "Torres", "Gomez", "Morales", "Neri", "Ocampo",
  "Gatmaitan", "Limpin", "Mendoza", "Cortez", "Pimentel", "Dimalanta", "Salonga", "Fernandez", "Escobar", "Navarro",
];

function isoDate(rng: () => number): string {
  // Births spread across the last ~18 months.
  const daysAgo = Math.floor(rng() * 540);
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export function generateFhirData(count = 120, seed = 42) {
  const rng = mulberry32(seed);
  const patients: FhirPatient[] = [];
  const observations: FhirObservation[] = [];
  const encounters: FhirEncounter[] = [];

  for (let i = 0; i < count; i++) {
    const pid = `P${(1000 + i).toString()}`;
    const caseId = formatCaseId(i + 1); // NBD-2026-00001 ...
    // Guarantee every region has at least one record: the first N patients
    // map 1:1 to the N regions, the rest are distributed pseudo-randomly.
    const region =
      i < PH_REGIONS.length
        ? PH_REGIONS[i]
        : PH_REGIONS[Math.floor(rng() * PH_REGIONS.length)];
    const city = REGION_CITY[region] ?? region;
    const birthDate = isoDate(rng);
    const sex = rng() > 0.5 ? "male" : "female";

    const fi = Math.floor(rng() * FILIPINO_FIRST_NAMES.length);
    const mi = Math.floor(rng() * FILIPINO_MIDDLE_NAMES.length);
    const si = Math.floor(rng() * FILIPINO_SURNAMES.length);
    const fni = Math.floor(rng() * FILIPINO_SURNAMES.length);
    const mni = Math.floor(rng() * FILIPINO_FIRST_NAMES.length);
    const mri = Math.floor(rng() * FILIPINO_SURNAMES.length);
    const lastName = FILIPINO_SURNAMES[si];
    const firstName = FILIPINO_FIRST_NAMES[fi];
    const middleName = FILIPINO_MIDDLE_NAMES[mi];
    const fatherName = FILIPINO_SURNAMES[fni];
    const motherName = `${FILIPINO_FIRST_NAMES[mni]} ${FILIPINO_SURNAMES[mri]}`;

    patients.push({
      resourceType: "Patient",
      id: pid,
      identifier: [
        { system: "urn:nbdsp:caseid", value: caseId },
        { system: "urn:nbdsp:mrn", value: `MRN-${10000 + i}` },
      ],
      active: true,
      name: [{ use: "official", family: lastName, given: [firstName, middleName] }],
      gender: sex,
      birthDate,
      address: [{ use: "home", state: region, city, country: "PH" }],
      meta: { lastUpdated: new Date().toISOString() },
      extension: [
        { url: "http://nbdsp.mil/fhir/extension/father-name", valueString: fatherName },
        { url: "http://nbdsp.mil/fhir/extension/mother-name", valueString: motherName },
      ],
    });

    // 1–2 observations (defects) per patient.
    const obsCount = 1 + (rng() > 0.75 ? 1 : 0);
    for (let j = 0; j < obsCount; j++) {
      const defect = DEFECTS[Math.floor(rng() * DEFECTS.length)];
      const severity = SEVERITIES[Math.floor(rng() * SEVERITIES.length)];
      const eid = `E${pid}`;
      observations.push({
        resourceType: "Observation",
        id: `O${pid}-${j}`,
        status: "final",
        category: [{ text: defect.category }],
        code: {
          coding: [{ system: "http://hl7.org/fhir/sid/icd-10", ...defect }],
          text: defect.display,
        },
        subject: { reference: `Patient/${pid}` },
        encounter: { reference: `Encounter/${eid}` },
        effectiveDateTime: birthDate,
        interpretation: [{ text: severity }],
        valueString: "confirmed",
      });

      if (j === 0) {
        encounters.push({
          resourceType: "Encounter",
          id: eid,
          status: "finished",
          class: { code: "IMP", display: "inpatient" },
          type: [{ text: "Newborn screening" }],
          subject: { reference: `Patient/${pid}` },
          period: { start: birthDate },
          serviceProvider: { display: facilityFor(region) },
        });
      }
    }
  }

  return { patients, observations, encounters };
}

function bundle<T>(resources: T[]): FhirBundle<T> {
  return {
    resourceType: "Bundle",
    type: "searchset",
    total: resources.length,
    entry: resources.map((resource) => ({ resource })),
  };
}

/** Mimic FHIR search interactions returning Bundles. */
export function fhirSearch(resourceType: "Patient" | "Observation" | "Encounter") {
  const { patients, observations, encounters } = generateFhirData();
  switch (resourceType) {
    case "Patient":
      return bundle(patients);
    case "Observation":
      return bundle(observations);
    case "Encounter":
      return bundle(encounters);
  }
}
