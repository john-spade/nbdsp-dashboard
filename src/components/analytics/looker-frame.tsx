"use client";

import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/primitives";
import { logClient } from "@/lib/api/client";

type State = "loading" | "ok" | "fail";

/**
 * Production-grade Looker Studio iframe wrapper.
 *
 * Rendered the moment a report URL exists. Sandboxed, responsive 16:9
 * (min-height 600px), with a loading skeleton, a 10s load timeout, and a
 * Retry. Load success/failure is beaconed (`iframe.load`) so embed stability
 * is observable in the admin telemetry view — even before a real URL is set.
 */
export function LookerFrame({ url }: { url: string }) {
  const [state, setState] = useState<State>("loading");
  const [nonce, setNonce] = useState(0); // bump to force a reload on Retry
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setState("loading");
    timer.current = setTimeout(() => {
      setState((s) => {
        if (s === "loading") {
          logClient("iframe.load.fail", url, { reason: "timeout" });
          return "fail";
        }
        return s;
      });
    }, 10_000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [url, nonce]);

  function onLoad() {
    if (timer.current) clearTimeout(timer.current);
    setState("ok");
    logClient("iframe.load.ok", url);
  }
  function onError() {
    if (timer.current) clearTimeout(timer.current);
    setState("fail");
    logClient("iframe.load.fail", url, { reason: "error" });
  }

  if (state === "fail") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm font-medium text-red-700">
          The Looker Studio report could not be loaded.
        </p>
        <p className="mt-1 text-xs text-red-500">
          Check the report URL / sharing settings, then retry.
        </p>
        <button
          onClick={() => setNonce((n) => n + 1)}
          className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-200">
      {state === "loading" && (
        <div className="absolute inset-0 z-10 p-4">
          <Skeleton className="h-full w-full" />
        </div>
      )}
      <div className="relative aspect-video min-h-[600px]">
        <iframe
          key={nonce}
          title="Looker Studio report"
          src={url}
          className="absolute inset-0 h-full w-full"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
          onLoad={onLoad}
          onError={onError}
        />
      </div>
    </div>
  );
}
