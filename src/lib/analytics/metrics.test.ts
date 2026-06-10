import { describe, expect, it } from "vitest";
import { computeMetrics } from "./metrics";
import type { ObservationRecord, PatientRecord, Sex } from "@/lib/fhir/models";

function monthKey(offset: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function patient(id: string, region: string | null, sex: Sex = "unknown"): PatientRecord {
  return {
    id,
    caseId: `NBD-2026-${id}`,
    mrn: null,
    lastName: id,
    firstName: "Test",
    middleName: "",
    fatherName: null,
    motherName: null,
    sex,
    birthDate: null,
    ageDays: null,
    region,
    city: null,
    active: true,
    lastUpdated: null,
  };
}

function obs(
  id: string,
  patientId: string,
  defectLabel: string,
  effectiveDate: string | null
): ObservationRecord {
  return {
    id,
    patientId,
    encounterId: null,
    status: "final",
    defectCode: null,
    defectSystem: null,
    defectLabel,
    category: null,
    severity: null,
    effectiveDate,
    value: null,
  };
}

describe("computeMetrics", () => {
  it("aggregates totals, regions, defects, KPIs and sex-by-defect", () => {
    const patients = [
      patient("P1", "NCR", "male"),
      patient("P2", "NCR", "female"),
      patient("P3", "Davao", "male"),
      patient("P4", null), // → "Unknown"
    ];
    const thisMonth = `${monthKey(0)}-15`;
    const prevMonth = `${monthKey(-1)}-10`;
    const observations = [
      obs("O1", "P1", "VSD", thisMonth),
      obs("O2", "P2", "VSD", thisMonth),
      obs("O3", "P3", "Cleft palate", prevMonth),
    ];

    const m = computeMetrics(patients, observations);

    expect(m.totalPatients).toBe(4);
    expect(m.totalObservations).toBe(3);

    expect(m.casesByRegion[0]).toEqual({ region: "NCR", count: 2 });
    expect(m.casesByRegion.find((r) => r.region === "Unknown")?.count).toBe(1);

    expect(m.defectDistribution[0]).toEqual({ label: "VSD", count: 2 });
    expect(m.mostCommonDefect).toEqual({ label: "VSD", count: 2 });
    expect(m.mostAffectedRegion).toEqual({ region: "NCR", count: 2 });

    // KPIs
    expect(m.newThisMonth).toBe(2);
    expect(m.prevMonth).toBe(1);

    // Continuous 18-month window, newest last = current month
    expect(m.monthlyTrend).toHaveLength(18);
    expect(m.monthlyTrend[17]).toEqual({ month: monthKey(0), count: 2 });
    expect(m.monthlyTrend[16]).toEqual({ month: monthKey(-1), count: 1 });

    // Sex by defect (VSD: 1 male P1, 1 female P2)
    const vsd = m.casesBySexByDefect.find((d) => d.defect === "VSD");
    expect(vsd).toEqual({ defect: "VSD", male: 1, female: 1 });
  });

  it("handles empty input", () => {
    const m = computeMetrics([], []);
    expect(m.totalPatients).toBe(0);
    expect(m.casesByRegion).toEqual([]);
    expect(m.defectDistribution).toEqual([]);
    expect(m.mostCommonDefect).toBeNull();
    expect(m.monthlyTrend).toHaveLength(18);
  });
});
