import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware — cheap gate only.
 *
 * The Firebase Admin SDK (needed to cryptographically verify the session
 * cookie) does NOT run on the Edge runtime, so we do a lightweight presence
 * check here and redirect unauthenticated users away from protected areas.
 * Authoritative verification happens in the (protected) server layout via
 * getSessionUser(), which also enforces per-route RBAC.
 */
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || "__nbdsp_session";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/patients",
  "/reports",
  "/admin",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (isProtected && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Already signed in → keep users out of the login page.
  if (pathname === "/login" && hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Forward the resolved path to server components so the (protected) layout
  // can enforce the per-route RBAC map (permissionForPath) authoritatively.
  // (Role checks can't run here — the Admin SDK is unavailable on the Edge.)
  const headers = new Headers(req.headers);
  headers.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/dashboard/:path*", "/patients/:path*", "/reports/:path*", "/admin/:path*", "/login"],
};
