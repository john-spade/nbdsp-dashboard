import "server-only";

import {
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Server-side Firebase Admin singleton (lazy).
 *
 * Initialization is deferred until first use so that `next build` (which
 * imports route modules without runtime secrets) does not crash. The
 * service-account credentials (FIREBASE_ADMIN_*) are SECRET and must never be
 * imported into a client component — the `server-only` guard enforces that.
 */
let _app: App | null = null;

function getAdminApp(): App {
  if (_app) return _app;
  if (getApps().length > 0) {
    _app = getApps()[0]!;
    return _app;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  // Private keys are stored with literal "\n"; restore real newlines.
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Set FIREBASE_ADMIN_PROJECT_ID, " +
        "FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY in .env.local"
    );
  }

  _app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return _app;
}

/**
 * Proxies that initialize the Admin app on first property access. Existing
 * call sites (`adminAuth.verifyIdToken(...)`, `adminDb.collection(...)`)
 * continue to work unchanged.
 */
export const adminAuth: Auth = new Proxy({} as Auth, {
  get(_t, prop) {
    const auth = getAuth(getAdminApp());
    const value = Reflect.get(auth, prop);
    return typeof value === "function" ? value.bind(auth) : value;
  },
});

export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_t, prop) {
    const db = getFirestore(getAdminApp());
    const value = Reflect.get(db, prop);
    return typeof value === "function" ? value.bind(db) : value;
  },
});
