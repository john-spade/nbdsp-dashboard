"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { logClient } from "@/lib/api/client";

/** Fires a page-visit beacon to the audit trail on every route change. */
export function PageTracker() {
  const pathname = usePathname();
  useEffect(() => {
    logClient("page.visit", pathname);
  }, [pathname]);
  return null;
}
