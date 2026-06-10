import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Structured logging + audit trail.
 *
 * Two destinations:
 *  1. console (captured by Firebase/GCP Cloud Logging in production)
 *  2. the `audit_logs` Firestore collection for security-relevant events
 *     (auth, data access, data writes) — queryable from the Admin Panel.
 */

type Level = "info" | "warn" | "error";

interface LogFields {
  [key: string]: unknown;
}

function emit(level: Level, message: string, fields: LogFields = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (msg: string, f?: LogFields) => emit("info", msg, f),
  warn: (msg: string, f?: LogFields) => emit("warn", msg, f),
  error: (msg: string, f?: LogFields) => emit("error", msg, f),
};

export type AuditAction =
  | "auth.login"
  | "auth.logout"
  | "auth.denied"
  | "data.read"
  | "data.write"
  | "user.create"
  | "patient.create"
  | "patient.edit"
  | "page.visit"
  | "api.call"
  | "error.client"
  | "perf.webvital"
  | "iframe.load"
  | "iframe.load.ok"
  | "iframe.load.fail";

export interface AuditEntry {
  action: AuditAction;
  actorUid: string | null;
  actorEmail: string | null;
  role: string | null;
  resource?: string;
  detail?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

/** Append an immutable audit record. Never throws into the request path. */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await adminDb.collection("audit_logs").add({
      ...entry,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    logger.error("audit_write_failed", { err: String(err), action: entry.action });
  }
}
