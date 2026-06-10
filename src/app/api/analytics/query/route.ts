import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { queryCases, type CaseFilters } from "@/lib/data/analytics-cases";

export const runtime = "nodejs";

/**
 * GET /api/analytics/query  (admin/analyst) — supplemental data querying.
 *
 * Case-level detail (one row per finding), so gated to the same audience as
 * the export feed — NOT viewers (who get aggregate charts only).
 *
 * Server-side Firestore filtering (no client array filtering) with count +
 * cursor pagination. Params:
 *   region=A&region=B  (repeatable)   defect=X&defect=Y  (repeatable)
 *   sex=male|female    from=YYYY-MM   to=YYYY-MM          cursor=<id>
 */
export const GET = withAuth("analytics:export", async (req) => {
  const sp = req.nextUrl.searchParams;
  const sex = sp.get("sex") ?? undefined;

  const filters: CaseFilters = {
    regions: sp.getAll("region").filter(Boolean),
    defects: sp.getAll("defect").filter(Boolean),
    sex: sex === "male" || sex === "female" ? sex : undefined,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
  };

  const cursor = sp.get("cursor");
  const result = await queryCases(filters, cursor);
  return NextResponse.json(result);
});
