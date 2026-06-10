"use client";

import { create } from "zustand";

/**
 * Mobile sidebar (off-canvas drawer) open/close state.
 *
 * Only relevant below the `md` breakpoint — on larger screens the sidebar is
 * always visible and this state is ignored. Lives in Zustand (already in the
 * stack) so the topbar hamburger and the sidebar/overlay can share it without
 * prop-drilling through the server layout.
 */
interface SidebarState {
  open: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
  close: () => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  open: false,
  toggle: () => set((s) => ({ open: !s.open })),
  setOpen: (open) => set({ open }),
  close: () => set({ open: false }),
}));
