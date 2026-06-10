import { NextResponse, type NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import {
  clearSessionCookie,
  createSessionCookie,
  getSessionUser,
  setSessionCookie,
} from "@/lib/auth/session";
import { audit, logger } from "@/lib/logging/logger";
import { clientIp } from "@/lib/api/handler";

export const runtime = "nodejs";

/**
 * POST /api/auth/session
 * Body: { idToken }  → exchanges a Firebase ID token for an httpOnly session
 * cookie. Called immediately after client-side signInWithEmailAndPassword.
 */
export async function POST(req: NextRequest) {
  const { idToken } = await req.json().catch(() => ({ idToken: null }));
  if (!idToken || typeof idToken !== "string") {
    return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const cookie = await createSessionCookie(idToken);
    await setSessionCookie(cookie);

    const role = (decoded.role as string) ?? "viewer";
    await audit({
      action: "auth.login",
      actorUid: decoded.uid,
      actorEmail: decoded.email ?? null,
      role,
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true, role });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Distinguish a server misconfiguration (Admin SDK not set up) from a
    // genuinely bad/expired token, so the operator sees the real cause.
    if (/Firebase Admin credentials/i.test(message)) {
      logger.error("session_admin_not_configured", { message });
      return NextResponse.json(
        {
          error:
            "Server auth is not configured: missing Firebase Admin service-account key " +
            "(FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY).",
        },
        { status: 503 }
      );
    }

    logger.warn("session_verify_failed", { message });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
}

/** DELETE /api/auth/session → logout. */
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  await clearSessionCookie();
  if (user) {
    await audit({
      action: "auth.logout",
      actorUid: user.uid,
      actorEmail: user.email,
      role: user.role,
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
  }
  return NextResponse.json({ ok: true });
}
