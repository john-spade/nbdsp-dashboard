import "server-only";

import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import { isRole, type Role } from "@/lib/auth/rbac";

export const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || "__nbdsp_session";
const FIVE_DAYS_MS = 60 * 60 * 24 * 5 * 1000;

export interface SessionUser {
  uid: string;
  email: string | null;
  role: Role;
  name: string | null;
}

/**
 * Exchange a short-lived Firebase ID token (from client sign-in) for a
 * long-lived, httpOnly session cookie. This keeps the credential out of
 * JavaScript-readable storage (XSS-safe) and lets API routes validate
 * requests server-side.
 */
export async function createSessionCookie(idToken: string): Promise<string> {
  return adminAuth.createSessionCookie(idToken, { expiresIn: FIVE_DAYS_MS });
}

export async function setSessionCookie(value: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, value, {
    maxAge: FIVE_DAYS_MS / 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Resolve the current authenticated user from the session cookie.
 * Returns null when there is no valid session (expired / revoked / missing).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const cookie = store.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  try {
    // checkRevoked = true ensures disabled/logged-out users are rejected.
    const decoded = await adminAuth.verifySessionCookie(cookie, true);
    const role = isRole(decoded.role) ? decoded.role : "viewer";
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      role,
      name: (decoded.name as string | undefined) ?? null,
    };
  } catch {
    return null;
  }
}
