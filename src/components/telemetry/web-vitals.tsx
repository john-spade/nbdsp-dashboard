"use client";

import { useReportWebVitals } from "next/web-vitals";
import { logClient } from "@/lib/api/client";

const TRACKED = new Set(["LCP", "CLS", "INP"]);

/**
 * Captures Core Web Vitals (LCP, CLS, INP) and beacons them to the audit /
 * telemetry trail via /api/log/client. Mounted once, app-wide.
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    if (!TRACKED.has(metric.name)) return;
    logClient(
      "perf.webvital",
      typeof window !== "undefined" ? window.location.pathname : undefined,
      {
        name: metric.name,
        value: Math.round(metric.value * 1000) / 1000,
        rating: metric.rating,
        id: metric.id,
      }
    );
  });
  return null;
}
