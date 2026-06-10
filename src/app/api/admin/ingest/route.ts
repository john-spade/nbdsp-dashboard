import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { runIngestion } from "@/lib/data/ingest";

export const runtime = "nodejs";

/**
 * POST /api/admin/ingest → run the FHIR ingestion pipeline on demand.
 * Admin-only. Returns the per-resource ingestion summary.
 */
export const POST = withAuth("ingestion:run", async () => {
  const summary = await runIngestion();
  return NextResponse.json({ ok: true, summary });
});
