import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { fhirSearch } from "@/lib/fhir/mock-source";

export const runtime = "nodejs";

/**
 * GET /api/fhir/:resource  (resource ∈ Patient | Observation | Encounter)
 *
 * Simulated FHIR R4 search endpoint. Returns a FHIR Bundle exactly as a real
 * FHIR server would, so the ingestion pipeline can be pointed here or at a
 * real endpoint with no code change.
 */
const SUPPORTED = ["Patient", "Observation", "Encounter"] as const;

export const GET = withAuth("observation:read", async (_req, { params }) => {
  const resource = params.resource;
  if (!SUPPORTED.includes(resource as (typeof SUPPORTED)[number])) {
    return NextResponse.json(
      { error: `Unsupported resource '${resource}'` },
      { status: 404 }
    );
  }
  const bundle = fhirSearch(resource as (typeof SUPPORTED)[number]);
  return NextResponse.json(bundle);
});
