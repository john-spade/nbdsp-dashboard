import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { listAllCases } from "@/lib/data/analytics-cases";

export const runtime = "nodejs";

/**
 * GET /api/analytics/export?format=csv  (admin/analyst)
 *
 * The de-identified, one-row-per-case dataset that Looker Studio / BigQuery
 * would consume. Point a Looker connector — or a scheduled BigQuery load — at
 * this endpoint to go live. No PHI: Case ID, region, defect, ICD-10, sex,
 * birth month, severity, status.
 */
const COLUMNS = [
  "caseId",
  "region",
  "defect",
  "icd10",
  "sex",
  "birthMonth",
  "severity",
  "status",
] as const;

function exportValue(
  row: Record<string, unknown>,
  column: (typeof COLUMNS)[number]
): unknown {
  return column === "defect" ? row.defectLabel : row[column];
}

function csvCell(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const GET = withAuth("analytics:export", async (req) => {
  const cases = await listAllCases();
  const format = req.nextUrl.searchParams.get("format") ?? "csv";

  if (format === "json") {
    return NextResponse.json({ rows: cases, total: cases.length });
  }

  const header = COLUMNS.join(",");
  const lines = cases.map((c) =>
    COLUMNS.map((col) => csvCell(exportValue(c as unknown as Record<string, unknown>, col))).join(",")
  );
  const csv = [header, ...lines].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nbdsp-analytics-feed.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
