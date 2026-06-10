import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { withAuth, clientIp } from "@/lib/api/handler";
import {
  getPatient,
  listEncountersForPatient,
  listObservationsForPatient,
  updatePatientBundle,
} from "@/lib/data/repository";
import { createPatientSchema } from "@/lib/fhir/validate";
import { assemblePatientBundle, changedPatientFields } from "@/lib/data/patient-write";
import { audit } from "@/lib/logging/logger";

export const runtime = "nodejs";

/** GET /api/patients/:id → patient + their observations + encounters. */
export const GET = withAuth("patient:read", async (_req, { params }) => {
  const patient = await getPatient(params.id);
  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }
  const [observations, encounters] = await Promise.all([
    listObservationsForPatient(params.id),
    listEncountersForPatient(params.id),
  ]);
  return NextResponse.json({ patient, observations, encounters });
});

/**
 * PATCH /api/patients/:id → edit an existing surveillance case.
 * Admin + encoder only (patient:edit) — viewers/analysts get 403 (withAuth).
 * Replaces the patient demographics + findings + encounter, then audits the
 * exact demographic fields that changed.
 */
export const PATCH = withAuth("patient:edit", async (req: NextRequest, { user, params }) => {
  const existing = await getPatient(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createPatientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const bundle = assemblePatientBundle(parsed.data, params.id);
  const changed = changedPatientFields(existing, bundle.patient);

  await updatePatientBundle(bundle);

  await audit({
    action: "patient.edit",
    actorUid: user.uid,
    actorEmail: user.email,
    role: user.role,
    resource: params.id,
    detail: {
      caseId: existing.caseId,
      fieldsChanged: changed,
      observations: parsed.data.observations.length,
    },
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  revalidatePath("/patients");
  revalidatePath(`/patients/${params.id}`);
  return NextResponse.json({ patient: { id: params.id, caseId: existing.caseId } });
});
