import type { Role } from "@/lib/auth/rbac";

/**
 * The embed seam.
 *
 * Resolves, per role, whether analytics should render the real Looker Studio
 * report (when a URL is configured) or the native in-app module. This mirrors
 * Looker row-level security: each role gets its own filtered report URL.
 *
 * Going live is a CONFIG change, not a code change — set the env var(s) and
 * the app auto-switches to Looker on next build.
 *
 * NOTE: `NEXT_PUBLIC_*` values are statically inlined by Next at build time,
 * so each must be referenced by its literal name (no dynamic key lookup).
 */
export type AnalyticsSource =
  | { mode: "looker"; url: string }
  | { mode: "native" };

export function getAnalyticsSource(role: Role): AnalyticsSource {
  // Encoders have no analytics access, so they never resolve a Looker URL —
  // return native explicitly instead of falling through to the viewer URL.
  if (role === "encoder") return { mode: "native" };

  const roleUrl =
    role === "admin"
      ? process.env.NEXT_PUBLIC_LOOKER_EMBED_URL_ADMIN
      : role === "analyst"
        ? process.env.NEXT_PUBLIC_LOOKER_EMBED_URL_ANALYST
        : process.env.NEXT_PUBLIC_LOOKER_EMBED_URL_VIEWER;

  // Role-specific URL → default URL → native.
  const url = (roleUrl || process.env.NEXT_PUBLIC_LOOKER_EMBED_URL || "").trim();
  return url ? { mode: "looker", url } : { mode: "native" };
}
