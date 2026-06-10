/**
 * Aggregation helpers — normalized records → SurveillanceMetrics.
 * Pure functions so they run identically on the server (API) or client.
 */
import type {
  ObservationRecord,
  PatientRecord,
  RegionStat,
  SurveillanceMetrics,
} from "@/lib/fhir/models";

function tally<T>(items: T[], key: (item: T) => string | null): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

function sortedEntries(map: Map<string, number>, limit?: number) {
  const entries = [...map.entries()].sort((a, b) => b[1] - a[1]);
  return limit ? entries.slice(0, limit) : entries;
}

/** Continuous list of the last `n` month keys (YYYY-MM), oldest → newest. */
function lastMonths(n: number, from = new Date()): string[] {
  const out: string[] = [];
  for (let k = n - 1; k >= 0; k--) {
    const d = new Date(from.getFullYear(), from.getMonth() - k, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function computeMetrics(
  patients: PatientRecord[],
  observations: ObservationRecord[]
): SurveillanceMetrics {
  const byRegion = tally(patients, (p) => p.region ?? "Unknown");
  const byDefect = tally(observations, (o) => o.defectLabel);
  const byMonth = tally(observations, (o) =>
    o.effectiveDate ? o.effectiveDate.slice(0, 7) : null
  );

  const casesByRegion = sortedEntries(byRegion).map(([region, count]) => ({
    region,
    count,
  }));
  const defectDistribution = sortedEntries(byDefect, 8).map(([label, count]) => ({
    label,
    count,
  }));

  // Continuous 18-month trend window (fill gaps with 0 for a clean area chart).
  const months = lastMonths(18);
  const monthlyTrend = months.map((month) => ({
    month,
    count: byMonth.get(month) ?? 0,
  }));
  const newThisMonth = byMonth.get(months[months.length - 1]) ?? 0;
  const prevMonth = byMonth.get(months[months.length - 2]) ?? 0;

  // Cases by sex across the top 5 defects (join patient sex → observation).
  const sexById = new Map(patients.map((p) => [p.id, p.sex]));
  const topDefects = defectDistribution.slice(0, 5).map((d) => d.label);
  const casesBySexByDefect = topDefects.map((defect) => {
    let male = 0;
    let female = 0;
    for (const o of observations) {
      if (o.defectLabel !== defect) continue;
      const sex = sexById.get(o.patientId);
      if (sex === "male") male++;
      else if (sex === "female") female++;
    }
    return { defect, male, female };
  });

  // Per-region report: join observations → patient region, tally cases +
  // top defect per region. Patients with no region roll up to "Unknown".
  const regionOf = new Map(patients.map((p) => [p.id, p.region ?? "Unknown"]));
  const patientsPerRegion = new Map<string, number>();
  for (const p of patients) {
    const r = p.region ?? "Unknown";
    patientsPerRegion.set(r, (patientsPerRegion.get(r) ?? 0) + 1);
  }
  const regionAgg = new Map<string, { cases: number; defects: Map<string, number> }>();
  for (const o of observations) {
    const r = regionOf.get(o.patientId) ?? "Unknown";
    const agg = regionAgg.get(r) ?? { cases: 0, defects: new Map() };
    agg.cases += 1;
    agg.defects.set(o.defectLabel, (agg.defects.get(o.defectLabel) ?? 0) + 1);
    regionAgg.set(r, agg);
  }
  const totalCases = observations.length || 1;
  const regions = new Set<string>([...patientsPerRegion.keys(), ...regionAgg.keys()]);
  const regionalBreakdown: RegionStat[] = [...regions]
    .map((region) => {
      const agg = regionAgg.get(region);
      const top = agg
        ? [...agg.defects.entries()].sort((a, b) => b[1] - a[1])[0]
        : undefined;
      return {
        region,
        patients: patientsPerRegion.get(region) ?? 0,
        cases: agg?.cases ?? 0,
        topDefect: top?.[0] ?? null,
        topDefectCount: top?.[1] ?? 0,
        share: (agg?.cases ?? 0) / totalCases,
      };
    })
    .sort((a, b) => b.cases - a.cases);

  return {
    totalPatients: patients.length,
    totalObservations: observations.length,
    newThisMonth,
    prevMonth,
    mostAffectedRegion: casesByRegion[0]
      ? { region: casesByRegion[0].region, count: casesByRegion[0].count }
      : null,
    mostCommonDefect: defectDistribution[0]
      ? { label: defectDistribution[0].label, count: defectDistribution[0].count }
      : null,
    casesByRegion,
    defectDistribution,
    monthlyTrend,
    casesBySexByDefect,
    regionalBreakdown,
    severityBreakdown: ["severe", "moderate", "mild"].map((severity) => ({
      severity,
      count: tally(observations, (o) => o.severity).get(severity) ?? 0,
    })),
  };
}
