import "server-only";

import { FieldPath } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import type { AnalyticsCase } from "@/lib/fhir/models";

export const ANALYTICS_CASES = "analytics_cases";

export interface CaseFilters {
  regions: string[];
  defects: string[];
  sex?: string;
  from?: string; // YYYY-MM
  to?: string; // YYYY-MM
}

/** Firestore allows up to 30 disjunction values total across `in` filters. */
function applyFilters(
  base: FirebaseFirestore.Query,
  f: CaseFilters
): FirebaseFirestore.Query {
  let q = base;
  if (f.regions.length) q = q.where("region", "in", f.regions.slice(0, 30));
  if (f.defects.length) q = q.where("defectLabel", "in", f.defects.slice(0, 30));
  if (f.sex) q = q.where("sex", "==", f.sex);
  if (f.from) q = q.where("effectiveDate", ">=", `${f.from}-01`);
  if (f.to) q = q.where("effectiveDate", "<=", `${f.to}-31`);
  return q;
}

export interface QueryResult {
  rows: AnalyticsCase[];
  total: number;
  nextCursor: string | null;
}

/**
 * Server-side, Firestore-native filtered query with count + cursor pagination.
 * (No client array filtering.) Cursor = the last row's document id.
 */
export async function queryCases(
  f: CaseFilters,
  cursor: string | null,
  pageSize = 25
): Promise<QueryResult> {
  const col = adminDb.collection(ANALYTICS_CASES);

  const filtered = applyFilters(col, f);
  const total = (await filtered.count().get()).data().count;

  let q = filtered
    .orderBy("effectiveDate", "desc")
    .orderBy(FieldPath.documentId(), "desc");

  if (cursor) {
    const snap = await col.doc(cursor).get();
    if (snap.exists) q = q.startAfter(snap);
  }

  const snap = await q.limit(pageSize).get();
  const rows = snap.docs.map((d) => d.data() as AnalyticsCase);
  const nextCursor =
    rows.length === pageSize ? snap.docs[snap.docs.length - 1].id : null;

  return { rows, total, nextCursor };
}

/** Full de-identified dataset for the export feed (Looker/BigQuery source). */
export async function listAllCases(limit = 10000): Promise<AnalyticsCase[]> {
  const snap = await adminDb.collection(ANALYTICS_CASES).limit(limit).get();
  return snap.docs.map((d) => d.data() as AnalyticsCase);
}
