import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/handler";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

/** GET /api/admin/audit → most recent audit-log entries (admin only). */
export const GET = withAuth("audit:read", async (req) => {
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 100), 500);
  const snap = await adminDb
    .collection("audit_logs")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  const entries = snap.docs.map((d) => {
    const data = d.data();
    const createdAt = data.createdAt?.toDate?.()?.toISOString() ?? null;
    return { id: d.id, ...data, createdAt };
  });

  return NextResponse.json({ entries });
});
