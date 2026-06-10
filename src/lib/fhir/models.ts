/**
 * Normalized domain models — the "UI-ready" shape.
 *
 * Everything in the app (components, charts, Firestore docs) speaks these
 * flat models, NOT raw FHIR. The transformation layer (transform.ts) is the
 * only place that knows about the FHIR wire format.
 */

export type Sex = "male" | "female" | "other" | "unknown";

export interface PatientRecord {
  id: string;
  caseId: string; // de-identified surveillance ID, e.g. NBD-2026-00042
  mrn: string | null; // medical record number / identifier (secondary)
  lastName: string;
  firstName: string;
  middleName: string;
  fatherName: string | null;
  motherName: string | null;
  sex: Sex;
  birthDate: string | null; // ISO date
  ageDays: number | null; // for neonatal surveillance
  region: string | null;
  city: string | null;
  active: boolean;
  lastUpdated: string | null;
}

export interface ObservationRecord {
  id: string;
  patientId: string;
  encounterId: string | null;
  status: FhirLikeStatus;
  defectCode: string | null; // e.g. ICD-10 Q-code
  defectSystem: string | null;
  defectLabel: string; // human-readable
  category: string | null; // birth defect group
  severity: string | null; // mild | moderate | severe
  effectiveDate: string | null;
  value: string | null; // normalized display value
}

export type FhirLikeStatus =
  | "registered"
  | "preliminary"
  | "final"
  | "amended"
  | "cancelled"
  | "unknown";

export interface EncounterRecord {
  id: string;
  patientId: string;
  status: string;
  type: string | null;
  facility: string | null;
  start: string | null;
  end: string | null;
}

export interface Counted {
  region: string;
  count: number;
}

export interface SexByDefect {
  defect: string;
  male: number;
  female: number;
}

export interface RegionStat {
  region: string;
  patients: number;
  cases: number; // observations attributed to the region
  topDefect: string | null;
  topDefectCount: number;
  share: number; // fraction of total cases (0–1)
}

/** Aggregated metrics consumed by the analytics module. */
export interface SurveillanceMetrics {
  totalPatients: number;
  totalObservations: number;
  newThisMonth: number;
  prevMonth: number;
  mostAffectedRegion: { region: string; count: number } | null;
  mostCommonDefect: { label: string; count: number } | null;
  casesByRegion: { region: string; count: number }[];
  defectDistribution: { label: string; count: number }[];
  monthlyTrend: { month: string; count: number }[]; // continuous, last 18 months
  casesBySexByDefect: SexByDefect[]; // top 5 defects
  regionalBreakdown: RegionStat[]; // per-region report rows, sorted by cases desc
  severityBreakdown: { severity: string; count: number }[]; // severe → mild
}

/**
 * De-identified, one-row-per-case analytics record.
 *
 * This is the **Looker / BigQuery feed shape** — the exact dataset a Looker
 * Studio connector (or a scheduled BigQuery load) would consume. Contains NO
 * PHI: only the surveillance Case ID, region, coded defect, sex, birth month,
 * severity and status.
 */
export interface AnalyticsCase {
  id: string; // = observation id (unique per finding)
  caseId: string; // NBD-2026-#####
  patientId: string;
  region: string;
  defectLabel: string;
  icd10: string;
  sex: Sex;
  birthMonth: string; // YYYY-MM
  effectiveDate: string; // YYYY-MM-DD
  severity: string;
  status: string;
}
