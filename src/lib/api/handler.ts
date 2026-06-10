import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { can, type Permission } from "@/lib/auth/rbac";
import { audit, logger } from "@/lib/logging/logger";

/**
 * API middleware wrapper.
 *
 * Wrap every protected route handler with `withAuth(permission, fn)`:
 *  - resolves + verifies the session cookie (401 if absent/invalid)
 *  - enforces RBAC for the required permission (403 if disallowed)
 *  - logs the API call to the audit trail
 *  - converts thrown errors into a safe 500 (no stack leakage)
 */
export type AuthedHandler = (
  req: NextRequest,
  ctx: { user: SessionUser; params: Record<string, string> }
) => Promise<NextResponse> | NextResponse;

export function withAuth(permission: Permission, handler: AuthedHandler) {
  return async (
    req: NextRequest,
    segment: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    const started = Date.now();
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!can(user.role, permission)) {
      await audit({
        action: "auth.denied",
        actorUid: user.uid,
        actorEmail: user.email,
        role: user.role,
        resource: req.nextUrl.pathname,
        detail: { permission },
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent"),
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
      const params = await segment.params;
      const res = await handler(req, { user, params });
      await audit({
        action: "api.call",
        actorUid: user.uid,
        actorEmail: user.email,
        role: user.role,
        resource: `${req.method} ${req.nextUrl.pathname}`,
        detail: { status: res.status, ms: Date.now() - started },
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent"),
      });
      return res;
    } catch (err) {
      logger.error("api_handler_error", {
        path: req.nextUrl.pathname,
        err: String(err),
      });
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
  };
}

export function clientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}
