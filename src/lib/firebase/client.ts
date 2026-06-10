"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

/**
 * Browser-side Firebase singleton.
 *
 * Only NEXT_PUBLIC_* values are used here — these are safe to ship to the
 * client. Firestore is still protected server-side by security rules + the
 * API middleware layer; the client SDK is used for Auth (sign-in) only.
 *
 * Auth/Firestore are created **lazily** (on first use, in the browser) rather
 * than at module load. This keeps static prerendering / SSR from calling
 * getAuth() during `next build` — which would throw `auth/invalid-api-key`
 * when the NEXT_PUBLIC_* vars aren't present at build time.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function firebaseApp(): FirebaseApp {
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

let _auth: Auth | undefined;
let _db: Firestore | undefined;

/** Browser Auth instance (sign-in / sign-out). Initialized on first call. */
export function getClientAuth(): Auth {
  if (!_auth) _auth = getAuth(firebaseApp());
  return _auth;
}

/** Browser Firestore instance. Initialized on first call. */
export function getClientDb(): Firestore {
  if (!_db) _db = getFirestore(firebaseApp());
  return _db;
}
