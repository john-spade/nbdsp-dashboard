"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { apiSend } from "@/lib/api/client";
import {
  DEFECTS,
  ENCOUNTER_STATUSES,
  ENCOUNTER_TYPES,
  PH_REGIONS,
  SEVERITIES,
  defectByDisplay,
  type Severity,
} from "@/lib/fhir/reference-data";
import type {
  EncounterRecord,
  ObservationRecord,
  PatientRecord,
} from "@/lib/fhir/models";

export interface ObsRow {
  defectLabel: string;
  defectOther: string; // custom label when Others is selected
  code: string;
  severity: Severity;
  recordedDate: string;
}

export interface PatientFormValues {
  lastName: string;
  firstName: string;
  middleName: string;
  fatherName: string;
  motherName: string;
  sex: "male" | "female";
  birthDate: string;
  region: string;
  city: string;
  observations: ObsRow[];
  encType: string;
  encFacility: string;
  encDate: string;
  encStatus: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const OTHERS_DISPLAY = "Others (specify)";

export function emptyObs(): ObsRow {
  return {
    defectLabel: DEFECTS[0].display,
    defectOther: "",
    code: DEFECTS[0].code,
    severity: "moderate",
    recordedDate: today(),
  };
}

/** Map the fetched normalized records back into editable form values. */
export function toFormValues(
  patient: PatientRecord,
  observations: ObservationRecord[],
  encounters: EncounterRecord[]
): PatientFormValues {
  const region = (PH_REGIONS as readonly string[]).includes(patient.region ?? "")
    ? (patient.region as string)
    : PH_REGIONS[0];
  const enc = encounters[0];
  const encType = (ENCOUNTER_TYPES as readonly string[]).includes(enc?.type ?? "")
    ? (enc!.type as string)
    : ENCOUNTER_TYPES[0];
  const encStatus = (ENCOUNTER_STATUSES as readonly string[]).includes(enc?.status ?? "")
    ? (enc!.status as string)
    : "finished";

  const obsRows: ObsRow[] = observations.map((o) => {
    const known = defectByDisplay(o.defectLabel);
    const isKnown = Boolean(known) && o.defectLabel !== OTHERS_DISPLAY;
    return {
      defectLabel: isKnown ? o.defectLabel : OTHERS_DISPLAY,
      defectOther: isKnown ? "" : o.defectLabel,
      code: o.defectCode ?? "",
      severity: (SEVERITIES as readonly string[]).includes(o.severity ?? "")
        ? (o.severity as Severity)
        : "moderate",
      recordedDate: o.effectiveDate?.slice(0, 10) || today(),
    };
  });

  return {
    lastName: patient.lastName,
    firstName: patient.firstName,
    middleName: patient.middleName,
    fatherName: patient.fatherName ?? "",
    motherName: patient.motherName ?? "",
    sex: patient.sex === "male" ? "male" : "female",
    birthDate: patient.birthDate?.slice(0, 10) || today(),
    region,
    city: patient.city ?? "",
    observations: obsRows.length > 0 ? obsRows : [emptyObs()],
    encType,
    encFacility: enc?.facility ?? "",
    encDate: enc?.start?.slice(0, 10) || today(),
    encStatus,
  };
}

function defaultValues(): PatientFormValues {
  return {
    lastName: "",
    firstName: "",
    middleName: "",
    fatherName: "",
    motherName: "",
    sex: "female",
    birthDate: today(),
    region: PH_REGIONS[0],
    city: "",
    observations: [emptyObs()],
    encType: ENCOUNTER_TYPES[0],
    encFacility: "",
    encDate: today(),
    encStatus: "finished",
  };
}

/**
 * Shared Add/Edit patient form. In "create" mode it POSTs a new case; in
 * "edit" mode it PATCHes the existing one (`patientId`) with the same payload
 * shape, pre-filled from `initial`.
 */
export function PatientForm({
  mode = "create",
  patientId,
  initial,
}: {
  mode?: "create" | "edit";
  patientId?: string;
  initial?: PatientFormValues;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = mode === "edit";
  const base = initial ?? defaultValues();

  const [lastName, setLastName] = useState(base.lastName);
  const [firstName, setFirstName] = useState(base.firstName);
  const [middleName, setMiddleName] = useState(base.middleName);
  const [fatherName, setFatherName] = useState(base.fatherName);
  const [motherName, setMotherName] = useState(base.motherName);
  const [sex, setSex] = useState<"male" | "female">(base.sex);
  const [birthDate, setBirthDate] = useState(base.birthDate);
  const [region, setRegion] = useState<string>(base.region);
  const [city, setCity] = useState(base.city);
  const [observations, setObservations] = useState<ObsRow[]>(base.observations);
  const [encType, setEncType] = useState<string>(base.encType);
  const [encFacility, setEncFacility] = useState(base.encFacility);
  const [encDate, setEncDate] = useState(base.encDate);
  const [encStatus, setEncStatus] = useState<string>(base.encStatus);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const caseIdPreview = useMemo(
    () => (isEdit ? patientId ?? "" : "NBD-2026-##### (auto-assigned on save)"),
    [isEdit, patientId]
  );

  function updateObs(i: number, patch: Partial<ObsRow>) {
    setObservations((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const payload = {
      lastName,
      firstName,
      middleName: middleName || undefined,
      fatherName: fatherName || undefined,
      motherName: motherName || undefined,
      sex,
      birthDate,
      region,
      city: city || undefined,
      observations: observations.map((o) => ({
        defectLabel: o.defectLabel === OTHERS_DISPLAY ? o.defectOther : o.defectLabel,
        code: o.code || undefined,
        severity: o.severity,
        recordedDate: o.recordedDate,
      })),
      encounter: {
        type: encType,
        facility: encFacility || undefined,
        date: encDate,
        status: encStatus,
      },
    };

    try {
      if (isEdit && patientId) {
        await apiSend(`/api/patients/${patientId}`, "PATCH", payload);
        toast(`Patient ${patientId} updated.`, "success");
        router.push(`/patients/${patientId}`);
        router.refresh();
      } else {
        const res = await apiSend<{ patient: { id: string } }>(
          "/api/patients",
          "POST",
          payload
        );
        toast(`Patient ${res.patient.id} created.`, "success");
        router.push(`/patients/${res.patient.id}`);
      }
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  const cancelHref = isEdit && patientId ? `/patients/${patientId}` : "/patients";

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href={cancelHref} className="text-sm text-maroon-600 hover:underline">
          ← Back
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-800">
          {isEdit ? "Edit Patient (Surveillance Case)" : "Add Patient (Surveillance Case)"}
        </h1>
        <p className="text-sm text-slate-500">
          Records a de-identified case as a FHIR Patient + Observation(s) + Encounter.
        </p>
      </div>

      {/* Patient */}
      <Card>
        <CardTitle>Patient</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Labeled label="Case ID">
            <input readOnly value={caseIdPreview} className="input bg-slate-50 text-slate-400" />
          </Labeled>
          <Labeled label="Sex">
            <select value={sex} onChange={(e) => setSex(e.target.value as "male" | "female")} className="input capitalize">
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </Labeled>
          <Labeled label="Last Name" required>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="input" placeholder="Dela Cruz" required />
          </Labeled>
          <Labeled label="First Name" required>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input" placeholder="Juan" required />
          </Labeled>
          <Labeled label="Middle Name">
            <input value={middleName} onChange={(e) => setMiddleName(e.target.value)} className="input" placeholder="Santos" />
          </Labeled>
          <Labeled label="Father's Name">
            <input value={fatherName} onChange={(e) => setFatherName(e.target.value)} className="input" placeholder="Pedro" />
          </Labeled>
          <Labeled label="Mother's Name">
            <input value={motherName} onChange={(e) => setMotherName(e.target.value)} className="input" placeholder="Maria" />
          </Labeled>
          <Labeled label="Birth date" required>
            <input type="date" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="input" />
          </Labeled>
          <Labeled label="Region">
            <select value={region} onChange={(e) => setRegion(e.target.value)} className="input">
              {PH_REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Labeled>
          <Labeled label="City / facility (optional)">
            <input value={city} onChange={(e) => setCity(e.target.value)} className="input" placeholder="Defaults to region seat" />
          </Labeled>
        </div>
      </Card>

      {/* Observations */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <CardTitle>Observations (Birth Defect Findings)</CardTitle>
          <button
            type="button"
            onClick={() => setObservations((r) => [...r, emptyObs()])}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-maroon-400 hover:text-maroon-700"
          >
            + Add finding
          </button>
        </div>
        <div className="space-y-4">
          {observations.map((o, i) => (
            <div key={i} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
              <Labeled label="Defect">
                <select
                  value={o.defectLabel}
                  onChange={(e) => {
                    const ref = defectByDisplay(e.target.value);
                    const isOthers = e.target.value === OTHERS_DISPLAY;
                    updateObs(i, {
                      defectLabel: e.target.value,
                      code: isOthers ? "" : (ref?.code ?? o.code),
                      defectOther: isOthers ? o.defectOther : "",
                    });
                  }}
                  className="input"
                >
                  {DEFECTS.map((d) => (
                    <option key={d.code} value={d.display}>{d.display}</option>
                  ))}
                </select>
              </Labeled>
              {o.defectLabel === OTHERS_DISPLAY ? (
                <>
                  <Labeled label="Custom defect (required)">
                    <input
                      value={o.defectOther}
                      onChange={(e) => updateObs(i, { defectOther: e.target.value })}
                      className="input"
                      placeholder="e.g. Limb reduction"
                    />
                  </Labeled>
                  <Labeled label="ICD-10 Q-code (optional)">
                    <input value={o.code} onChange={(e) => updateObs(i, { code: e.target.value })} className="input" placeholder="e.g. Q69.9" />
                  </Labeled>
                </>
              ) : (
                <Labeled label="ICD-10 Q-code">
                  <input value={o.code} onChange={(e) => updateObs(i, { code: e.target.value })} className="input" />
                </Labeled>
              )}
              <Labeled label="Severity">
                <select value={o.severity} onChange={(e) => updateObs(i, { severity: e.target.value as Severity })} className="input capitalize">
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Labeled>
              <Labeled label="Recorded date">
                <input type="date" required value={o.recordedDate} onChange={(e) => updateObs(i, { recordedDate: e.target.value })} className="input" />
              </Labeled>
              {observations.length > 1 && (
                <button
                  type="button"
                  onClick={() => setObservations((rows) => rows.filter((_, idx) => idx !== i))}
                  className="justify-self-start text-xs font-medium text-red-600 hover:underline"
                >
                  Remove finding
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Encounter */}
      <Card>
        <CardTitle>Encounter</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Labeled label="Type">
            <select value={encType} onChange={(e) => setEncType(e.target.value)} className="input">
              {ENCOUNTER_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Facility (optional)">
            <input value={encFacility} onChange={(e) => setEncFacility(e.target.value)} className="input" placeholder="Defaults to region medical center" />
          </Labeled>
          <Labeled label="Date">
            <input type="date" required value={encDate} onChange={(e) => setEncDate(e.target.value)} className="input" />
          </Labeled>
          <Labeled label="Status">
            <select value={encStatus} onChange={(e) => setEncStatus(e.target.value)} className="input capitalize">
              {ENCOUNTER_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Labeled>
        </div>
      </Card>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="flex justify-end gap-2">
        <Link
          href={cancelHref}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-400"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-maroon-600 px-5 py-2 text-sm font-semibold text-white hover:bg-maroon-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : isEdit ? "Save changes" : "Save patient"}
        </button>
      </div>
    </form>
  );
}

function Labeled({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-maroon-600"> *</span>}
      </span>
      {children}
    </label>
  );
}
