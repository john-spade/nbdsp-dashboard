import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { audit, type AuditAction } from "@/lib/logging/logger";
import { clientIp } from "@/lib/api/handler";

export const runtime = "nodejs";

const ALLOWED: AuditAction[] = [
  "page.visit",
  "error.client",
  "perf.webvital",
  "iframe.load",
  "iframe.load.ok",
  "iframe.load.fail",
];

/**
 * POST /api/log/client
 * Client telemetry beacon: page visits, client errors, Web Vitals, and Looker
 * iframe load events. Open to any authenticated session.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  // Fire-and-forget telemetry: when there is no session (e.g. Web Vitals firing
  // on the public /login page) silently no-op with 204 rather than surfacing a
  // 401 network error in the browser console. Nothing is attributed/logged.
  if (!user) return new NextResponse(null, { status: 204 });

  const body = await req.json().catch(() => null);
  const action: AuditAction = ALLOWED.includes(body?.action) ? body.action : "page.visit";

  await audit({
    action,
    actorUid: user.uid,
    actorEmail: user.email,
    role: user.role,
    resource: typeof body?.resource === "string" ? body.resource : undefined,
    detail: body?.detail && typeof body.detail === "object" ? body.detail : undefined,
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
