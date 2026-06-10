import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionUser } from "@/lib/auth/session";
import { can, defaultRouteFor, permissionForPath } from "@/lib/auth/rbac";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { PageTracker } from "@/components/layout/page-tracker";
import { SidebarOverlay } from "@/components/layout/sidebar-overlay";
import { SessionProvider } from "@/components/auth/session-context";

/**
 * Authoritative auth + RBAC gate for the whole app.
 *
 * The Edge middleware only checks cookie presence; here we cryptographically
 * verify the session (Admin SDK) and enforce the per-route permission map
 * (the "server" layer of the 3-layer RBAC) before any page renders. API
 * handlers re-verify independently via withAuth().
 *
 * Layout shell (Part 2): the sidebar + topbar are fixed and never scroll —
 * only <main> scrolls.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Per-route RBAC. The path is forwarded by middleware via `x-pathname`.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const required = permissionForPath(pathname);
  if (required && !can(user.role, required)) {
    redirect(defaultRouteFor(user.role));
  }

  return (
    <SessionProvider
      user={{ uid: user.uid, email: user.email, role: user.role, name: user.name }}
    >
      <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
        <Sidebar user={user} />
        <SidebarOverlay />
        {/* Content column — offset for the fixed sidebar on md+. */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden md:pl-56">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
        <PageTracker />
      </div>
    </SessionProvider>
  );
}
