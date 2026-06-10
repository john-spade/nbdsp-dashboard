"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { cn } from "@/lib/utils/cn";
import { can } from "@/lib/auth/rbac";
import { getClientAuth } from "@/lib/firebase/client";
import { apiSend } from "@/lib/api/client";
import { Logo } from "@/components/ui/logo";
import { useSidebarStore } from "@/lib/stores/sidebar";
import type { SessionUser } from "@/lib/auth/session";
import { NAV_ITEMS } from "./nav-config";

export function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const { open, close } = useSidebarStore();
  const items = NAV_ITEMS.filter((item) => can(user.role, item.permission));

  // Active = the longest nav href that prefixes the current path (so
  // "/admin/users" wins over "/admin").
  const activeHref = items
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const initials = (user.name || user.email || "U")
    .split(/[\s@.]/)[0]
    .slice(0, 2)
    .toUpperCase();

  async function logout() {
    try {
      await apiSend("/api/auth/session", "DELETE");
      await signOut(getClientAuth());
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <aside
      className={cn(
        // Fixed, full-height, never scrolls off screen. Its own nav may scroll.
        "fixed left-0 top-0 z-50 flex h-full w-56 flex-col border-r border-slate-200 bg-white",
        // Off-canvas drawer on mobile; always visible from md up.
        "transform transition-transform duration-200 md:z-40 md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
        <Logo size={36} />
        <div className="leading-tight">
          <p className="text-sm font-bold text-maroon-700">NBDSP</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">
            Surveillance
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3 scroll-thin">
        {items.map((item) => {
          const active = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={close}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-maroon-600 text-white"
                  : "text-slate-600 hover:bg-maroon-50 hover:text-maroon-700"
              )}
            >
              <span className="w-4 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User identity + logout, pinned to the bottom of the sidebar. */}
      <div className="border-t border-slate-200 p-3">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-maroon-600 text-xs font-bold text-white">
            {initials}
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium text-slate-700">
              {user.name || user.email}
            </p>
            <p className="text-xs capitalize text-slate-400">{user.role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-maroon-400 hover:text-maroon-700"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
