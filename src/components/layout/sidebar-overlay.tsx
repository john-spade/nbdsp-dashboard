"use client";

import { useSidebarStore } from "@/lib/stores/sidebar";

/** Dim backdrop shown behind the off-canvas sidebar on mobile; tap to close. */
export function SidebarOverlay() {
  const { open, close } = useSidebarStore();
  if (!open) return null;
  return (
    <div
      onClick={close}
      aria-hidden
      className="fixed inset-0 z-40 bg-black/40 md:hidden"
    />
  );
}
