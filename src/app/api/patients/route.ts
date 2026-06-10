import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { withAuth, clientIp } from "@/lib/api/handler";
import { countPatients, createPatientBundle, listPatients } from "@/lib/data/repository";
import { createPatientSchema } from "@/lib/fhir/validate";
import { assemblePatientBundle } from "@/lib/data/patient-write";
import { formatCaseId } from "@/lib/fhir/reference-data";
import { audit } from "@/lib/logging/logger";

export const runtime = "nodejs";

/** GET /api/patients → normalized patient list. (admin / encoder / analyst) */
export const GET = withAuth("patient:read", async () => {
  const patients = await listPatients();
  return NextResponse.json({ patients, total: patients.length });
});

/**
 * POST /api/patients → create a patient + observation(s) + encounter.
 * Admin + encoder (patient:write). Assembles FHIR resources, runs them through
 * the same transform layer as ingestion, then stores the normalized records.
 */
export const POST = withAuth("patient:write", async (req: NextRequest, { user }) => {
  const body = await req.json().catch(() => null);
  const parsed = createPatientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // Assign the next sequential Case ID; use it as the document id.
  const seq = (await countPatients()) + 1;
  const caseId = formatCaseId(seq);

  const bundle = assemblePatientBundle(input, caseId);
  await createPatientBundle(bundle);

  await audit({
    action: "patient.create",
    actorUid: user.uid,
    actorEmail: user.email,
    role: user.role,
    resource: caseId,
    detail: { observations: input.observations.length, region: input.region },
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  revalidatePath("/patients");
  return NextResponse.json({ patient: { id: caseId, caseId } }, { status: 201 });
});
