"use client";

import { useEffect } from "react";
import { logClient } from "@/lib/api/client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logClient("error.client", "app", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-red-700">Something went wrong</h2>
        <p className="mt-2 text-sm text-slate-500">
          The error has been logged. You can retry or return to the dashboard.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-maroon-600 px-4 py-2 text-sm font-semibold text-white hover:bg-maroon-700"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-maroon-400"
          >
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
