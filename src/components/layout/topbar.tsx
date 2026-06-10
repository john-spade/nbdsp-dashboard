"use client";

import { useSidebarStore } from "@/lib/stores/sidebar";

export function Topbar() {
  const toggleSidebar = useSidebarStore((s) => s.toggle);

  return (
    // Fixed height, non-scrolling sibling above <main>; stays put on long pages.
    <header className="z-30 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
      <button
        onClick={toggleSidebar}
        aria-label="Toggle navigation"
        className="rounded-lg border border-slate-300 p-2 text-slate-600 transition hover:border-maroon-400 hover:text-maroon-700 md:hidden"
      >
        <span className="block h-0.5 w-5 bg-current" />
        <span className="mt-1 block h-0.5 w-5 bg-current" />
        <span className="mt-1 block h-0.5 w-5 bg-current" />
      </button>
      <div>
        <h2 className="text-sm font-semibold text-slate-700">
          National Birth Defects Surveillance
        </h2>
        <p className="hidden text-xs text-slate-400 sm:block">
          Department of Health · Philippines
        </p>
      </div>
    </header>
  );
}
