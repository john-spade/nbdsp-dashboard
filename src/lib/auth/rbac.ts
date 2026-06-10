/**
 * Role-Based Access Control (RBAC) definitions.
 *
 * Roles are stored as Firebase Auth custom claims AND mirrored on the
 * `users` Firestore document. Custom claims are the source of truth for
 * authorization because they are cryptographically bound to the ID token.
 *
 * Four roles: admin / encoder / analyst / viewer. (An "encoder" is the
 * data-entry staff member who registers and edits surveillance cases.)
 */
export const ROLES = ["admin", "encoder", "analyst", "viewer"] as const;
export type Role = (typeof ROLES)[number];

/** Capabilities each role grants. Checked at route + component + API level. */
export const PERMISSIONS = {
  // Dashboard (every authenticated role).
  "dashboard:read": ["admin", "encoder", "analyst", "viewer"],

  // Patient data.
  "patient:read": ["admin", "encoder", "analyst"],
  "patient:write": ["admin", "encoder"],
  "patient:edit": ["admin", "encoder"],

  // Observation data mirrors patient access (data editors + readers).
  "observation:read": ["admin", "encoder", "analyst"],
  "observation:write": ["admin", "encoder"],

  // Analytics. Viewers get aggregate/chart access only (read), never export.
  "analytics:read": ["admin", "analyst", "viewer"],
  "analytics:export": ["admin", "analyst"],

  // Admin-only capabilities.
  "user:manage": ["admin"],
  "ingestion:run": ["admin"],
  "audit:read": ["admin"],

  // Page-level gates used by the sidebar + route guard.
  "page:admin": ["admin"],
  "page:reports": ["admin", "analyst"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Default landing route per role after login. */
export function defaultRouteFor(role: Role): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "encoder":
      return "/patients";
    case "analyst":
    case "viewer":
    default:
      return "/dashboard";
  }
}

/**
 * Authoritative per-route protection map (the "server" layer of the 3-layer
 * RBAC). The protected layout resolves the request path and enforces the
 * matching permission before any page renders; API handlers re-verify
 * independently via withAuth().
 *
 * Order matters — the most specific prefixes are listed first.
 */
const ROUTE_GUARDS: { test: (path: string) => boolean; permission: Permission }[] = [
  { test: (p) => p === "/patients/new", permission: "patient:write" },
  { test: (p) => /^\/patients\/[^/]+\/edit$/.test(p), permission: "patient:edit" },
  { test: (p) => /^\/patients\/[^/]+$/.test(p), permission: "patient:read" },
  { test: (p) => p === "/patients" || p.startsWith("/patients/"), permission: "patient:read" },
  { test: (p) => p === "/reports" || p.startsWith("/reports/"), permission: "page:reports" },
  { test: (p) => p === "/admin" || p.startsWith("/admin/"), permission: "page:admin" },
  { test: (p) => p === "/dashboard" || p.startsWith("/dashboard/"), permission: "dashboard:read" },
];

/** Required permission for a protected path, or null when unguarded. */
export function permissionForPath(pathname: string): Permission | null {
  return ROUTE_GUARDS.find((g) => g.test(pathname))?.permission ?? null;
}
