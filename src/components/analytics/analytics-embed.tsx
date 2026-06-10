"use client";

import type { Role } from "@/lib/auth/rbac";
import { getAnalyticsSource } from "@/lib/analytics/embed-config";
import { Badge } from "@/components/ui/primitives";
import { LookerFrame } from "./looker-frame";
import { NativeAnalytics } from "./native-analytics";

/**
 * The single analytics seam.
 *
 * Decides at runtime — from role-aware config — which renderer to show:
 *   • "looker"  → real sandboxed Looker Studio iframe
 *   • "native"  → in-app Recharts module
 * A status chip honestly reports the active source. Swapping to Looker is a
 * config change (env var), never a code change.
 */
export function AnalyticsEmbed({ role }: { role: Role }) {
  const source = getAnalyticsSource(role);
  const isLooker = source.mode === "looker";

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge tone={isLooker ? "green" : "maroon"}>
          <span
            className={
              isLooker
                ? "mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500"
                : "mr-1.5 h-1.5 w-1.5 rounded-full bg-maroon-600"
            }
          />
          Active source: {isLooker ? "Looker Studio" : "Native Analytics Module"}
        </Badge>
      </div>

      {isLooker ? <LookerFrame url={source.url} /> : <NativeAnalytics />}
    </section>
  );
}
