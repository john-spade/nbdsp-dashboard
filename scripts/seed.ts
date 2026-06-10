/**
 * Seed / bootstrap script.
 *
 *   npm run seed                         # ingest mock FHIR → Firestore
 *   npm run seed -- --role admin --email you@doh.gov.ph
 *                                        # also grant a role to an existing
 *                                        # Firebase Auth user
 *
 * Run with the Admin credentials present in .env.local. This script talks to
 * firebase-admin directly (it does NOT import the server-only app modules) so
 * it can run as a plain Node process.
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { generateFhirData } from "../src/lib/fhir/mock-source";
import {
  validateEncounters,
  validateObservations,
  validatePatients,
} from "../src/lib/fhir/validate";
import {
  toEncounterRecord,
  toObservationRecord,
  toPatientRecord,
} from "../src/lib/fhir/transform";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function initAdmin() {
  if (getApps().length) return;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing FIREBASE_ADMIN_* env vars. Populate .env.local first.");
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

async function upsert(collection: string, records: { id: string }[]) {
  const db = getFirestore();
  for (let i = 0; i < records.length; i += 450) {
    const batch = db.batch();
    for (const r of records.slice(i, i + 450)) {
      batch.set(db.collection(collection).doc(r.id), r, { merge: true });
    }
    await batch.commit();
  }
  return records.length;
}

/** Demo accounts created (idempotently) on every seed run. */
const DEMO_USERS = [
  { email: "encoder@nbdsp.demo", password: "Encoder@2026", role: "encoder" },
] as const;

/** Create the user if missing, then (re)assert its role claim + profile doc. */
async function ensureDemoUser(u: { email: string; password: string; role: string }) {
  let uid: string;
  try {
    const existing = await getAuth().getUserByEmail(u.email);
    uid = existing.uid;
  } catch (err) {
    if ((err as { code?: string }).code === "auth/user-not-found") {
      const created = await getAuth().createUser({
        email: u.email,
        password: u.password,
        emailVerified: true,
        disabled: false,
      });
      uid = created.uid;
    } else {
      throw err;
    }
  }
  await getAuth().setCustomUserClaims(uid, { role: u.role });
  await getFirestore().collection("users").doc(uid).set(
    {
      uid,
      email: u.email,
      role: u.role,
      createdBy: "seed",
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  console.log(`✅ Demo user ready: ${u.email} (role "${u.role}")`);
}

async function main() {
  initAdmin();

  // 1. Optional: grant a role to an existing user.
  const role = arg("--role");
  const email = arg("--email");
  if (role && email) {
    const user = await getAuth().getUserByEmail(email);
    await getAuth().setCustomUserClaims(user.uid, { role });
    await getFirestore().collection("users").doc(user.uid).set(
      { uid: user.uid, email, role, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    console.log(`✅ Granted role "${role}" to ${email}`);
  }

  // 1b. Ensure demo accounts exist (e.g. the encoder demo login).
  for (const u of DEMO_USERS) {
    await ensureDemoUser(u);
  }

  // 2. Ingest mock FHIR data through the real transform pipeline.
  const { patients, observations, encounters } = generateFhirData();
  const vp = validatePatients(patients);
  const vo = validateObservations(observations);
  const ve = validateEncounters(encounters);

  const p = await upsert("patients", vp.valid.map(toPatientRecord));
  const o = await upsert("observations", vo.valid.map(toObservationRecord));
  const e = await upsert("encounters", ve.valid.map(toEncounterRecord));

  console.log(`✅ Seeded ${p} patients, ${o} observations, ${e} encounters.`);
  console.log("Done.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
