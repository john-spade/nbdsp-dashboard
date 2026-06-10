/**
 * Zod schemas guarding the FHIR boundary and the create-endpoint inputs.
 *
 * For ingestion we validate the minimum structure required to transform
 * safely (unknown extra fields allowed). For create endpoints we validate
 * the operator-supplied form payload strictly.
 */
import { z } from "zod";
import type { FhirEncounter, FhirObservation, FhirPatient } from "./types";
import {
  ENCOUNTER_STATUSES,
  ENCOUNTER_TYPES,
  PH_REGIONS,
  SEVERITIES,
} from "./reference-data";
import { ROLES } from "../auth/rbac";

const codingSchema = z
  .object({
    system: z.string().optional(),
    code: z.string().optional(),
    display: z.string().optional(),
  })
  .passthrough();

const codeableConceptSchema = z
  .object({
    coding: z.array(codingSchema).optional(),
    text: z.string().optional(),
  })
  .passthrough();

const referenceSchema = z
  .object({ reference: z.string().optional(), display: z.string().optional() })
  .passthrough();

export const patientSchema = z
  .object({
    resourceType: z.literal("Patient"),
    id: z.string().min(1),
    gender: z.enum(["male", "female", "other", "unknown"]).optional(),
    birthDate: z.string().optional(),
  })
  .passthrough();

export const observationSchema = z
  .object({
    resourceType: z.literal("Observation"),
    id: z.string().min(1),
    status: z.string(),
    code: codeableConceptSchema,
    subject: referenceSchema,
  })
  .passthrough();

export const encounterSchema = z
  .object({
    resourceType: z.literal("Encounter"),
    id: z.string().min(1),
    status: z.string(),
    subject: referenceSchema,
  })
  .passthrough();

export interface ValidationResult<T> {
  valid: T[];
  errors: { index: number; message: string }[];
}

/** Validate a list, collecting (not throwing) per-item errors for the audit log. */
function validateMany<T>(
  items: unknown[],
  schema: z.ZodTypeAny
): ValidationResult<T> {
  const valid: T[] = [];
  const errors: { index: number; message: string }[] = [];
  items.forEach((item, index) => {
    const parsed = schema.safeParse(item);
    if (parsed.success) valid.push(parsed.data as T);
    else errors.push({ index, message: parsed.error.issues[0]?.message ?? "invalid" });
  });
  return { valid, errors };
}

export const validatePatients = (items: unknown[]) =>
  validateMany<FhirPatient>(items, patientSchema);
export const validateObservations = (items: unknown[]) =>
  validateMany<FhirObservation>(items, observationSchema);
export const validateEncounters = (items: unknown[]) =>
  validateMany<FhirEncounter>(items, encounterSchema);

// ───────────────────────────── Create-endpoint inputs ─────────────────────

/** POST /api/admin/users body. */
export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(ROLES),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

/** POST /api/patients body — the Add Patient form payload. */
export const createPatientSchema = z.object({
  lastName: z.string().min(1, "Last name is required"),
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  sex: z.enum(["male", "female"]),
  birthDate: z.string().min(1, "Birth date is required"),
  region: z.enum(PH_REGIONS),
  city: z.string().optional(),
  observations: z
    .array(
      z.object({
        defectLabel: z.string().min(1, "Defect is required"),
        code: z.string().optional(),
        severity: z.enum(SEVERITIES),
        recordedDate: z.string().min(1, "Recorded date is required"),
      })
    )
    .min(1, "At least one observation is required"),
  encounter: z.object({
    type: z.enum(ENCOUNTER_TYPES),
    facility: z.string().optional(),
    date: z.string().min(1, "Encounter date is required"),
    status: z.enum(ENCOUNTER_STATUSES),
  }),
});
export type CreatePatientInput = z.infer<typeof createPatientSchema>;
