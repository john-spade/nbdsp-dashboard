"use client";

/** Thin fetch wrapper for the browser → internal API routes. */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "same-origin" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function apiSend<T>(
  path: string,
  method: "POST" | "DELETE" | "PATCH",
  body?: unknown
): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export type ClientBeaconAction =
  | "page.visit"
  | "error.client"
  | "perf.webvital"
  | "iframe.load.ok"
  | "iframe.load.fail";

/** Fire-and-forget client telemetry beacon. */
export function logClient(
  action: ClientBeaconAction,
  resource?: string,
  detail?: Record<string, unknown>
) {
  try {
    const payload = JSON.stringify({ action, resource, detail });
    navigator.sendBeacon?.("/api/log/client", payload) ||
      fetch("/api/log/client", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      });
  } catch {
    /* never let telemetry break the UI */
  }
}
