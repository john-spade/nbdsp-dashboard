/**
 * Shared surveillance reference data.
 *
 * Single source of truth for regions, birth-defect codes, severities, and
 * encounter vocabularies — consumed by the mock FHIR source AND the
 * "Add Patient" form so the two never drift apart.
 */

/** The 18 administrative regions of the Philippines (official). */
export const PH_REGIONS = [
  "National Capital Region (NCR)",
  "Cordillera Administrative Region (CAR)",
  "Region I (Ilocos Region)",
  "Region II (Cagayan Valley)",
  "Region III (Central Luzon)",
  "Region IV-A (CALABARZON)",
  "MIMAROPA Region",
  "Region V (Bicol Region)",
  "Negros Island Region (NIR)",
  "Region VI (Western Visayas)",
  "Region VII (Central Visayas)",
  "Region VIII (Eastern Visayas)",
  "Region IX (Zamboanga Peninsula)",
  "Region X (Northern Mindanao)",
  "Region XI (Davao Region)",
  "Region XII (SOCCSKSARGEN)",
  "Region XIII (Caraga)",
  "Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)",
] as const;

/** Representative city / facility seat per region (used to fill City/facility). */
export const REGION_CITY: Record<string, string> = {
  "National Capital Region (NCR)": "Manila",
  "Cordillera Administrative Region (CAR)": "Baguio City",
  "Region I (Ilocos Region)": "San Fernando, La Union",
  "Region II (Cagayan Valley)": "Tuguegarao City",
  "Region III (Central Luzon)": "San Fernando, Pampanga",
  "Region IV-A (CALABARZON)": "Calamba, Laguna",
  "MIMAROPA Region": "Calapan City",
  "Region V (Bicol Region)": "Legazpi City",
  "Negros Island Region (NIR)": "Bacolod City",
  "Region VI (Western Visayas)": "Iloilo City",
  "Region VII (Central Visayas)": "Cebu City",
  "Region VIII (Eastern Visayas)": "Tacloban City",
  "Region IX (Zamboanga Peninsula)": "Zamboanga City",
  "Region X (Northern Mindanao)": "Cagayan de Oro City",
  "Region XI (Davao Region)": "Davao City",
  "Region XII (SOCCSKSARGEN)": "Koronadal City",
  "Region XIII (Caraga)": "Butuan City",
  "Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)": "Cotabato City",
};

export function facilityFor(region: string): string {
  const city = REGION_CITY[region] ?? region;
  return `${city} Medical Center`;
}

/** ICD-10 Q-codes for congenital malformations (birth defects). */
export interface DefectRef {
  code: string;
  display: string;
  category: string;
}

export const DEFECTS: DefectRef[] = [
  { code: "Q21.0", display: "Ventricular septal defect", category: "Congenital heart defect" },
  { code: "Q35.9", display: "Cleft palate", category: "Orofacial cleft" },
  { code: "Q37.9", display: "Cleft lip with cleft palate", category: "Orofacial cleft" },
  { code: "Q05.9", display: "Spina bifida", category: "Neural tube defect" },
  { code: "Q00.0", display: "Anencephaly", category: "Neural tube defect" },
  { code: "Q66.0", display: "Talipes equinovarus (clubfoot)", category: "Limb defect" },
  { code: "Q90.9", display: "Down syndrome", category: "Chromosomal" },
  { code: "Q79.3", display: "Gastroschisis", category: "Abdominal wall defect" },
  { code: "OTH", display: "Others (specify)", category: "Other defect" },
];

export function defectByDisplay(display: string): DefectRef | undefined {
  return DEFECTS.find((d) => d.display === display);
}

export const SEVERITIES = ["mild", "moderate", "severe"] as const;
export type Severity = (typeof SEVERITIES)[number];

/** Compact label for charts/axes — full region names are long. */
export function shortRegion(name: string): string {
  const m = name.match(/\(([^)]+)\)/);
  if (m && m[1].length <= 10) return m[1];
  return name.replace(/\s*\(.*\)\s*/, "").trim();
}

export const ENCOUNTER_TYPES = ["Newborn screening", "Referral", "Follow-up"] as const;
export const ENCOUNTER_STATUSES = ["planned", "in-progress", "finished"] as const;

/** Case ID scheme: NBD-2026-##### (5-digit, zero-padded). */
export const CASE_ID_YEAR = 2026;
export function formatCaseId(seq: number): string {
  return `NBD-${CASE_ID_YEAR}-${String(seq).padStart(5, "0")}`;
}
