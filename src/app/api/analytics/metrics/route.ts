import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { listObservations, listPatients } from "@/lib/data/repository";
import { computeMetrics } from "@/lib/analytics/metrics";

export const runtime = "nodejs";

/** GET /api/analytics/metrics → aggregated SurveillanceMetrics for charts. */
export const GET = withAuth("analytics:read", async () => {
  const [patients, observations] = await Promise.all([
    listPatients(),
    listObservations(),
  ]);
  const metrics = computeMetrics(patients, observations);
  return NextResponse.json({ metrics });
});
