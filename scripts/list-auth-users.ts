/**
 * Dump every Firebase Auth user (paginated) as JSON.
 *
 *   npm run users           # pretty table to stdout
 *   npm run users -- --json # full JSON
 *
 * Requires FIREBASE_ADMIN_* in .env.local (service-account key).
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type UserRecord } from "firebase-admin/auth";

function initAdmin() {
  if (getApps().length) return;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing FIREBASE_ADMIN_* env vars. Add the service-account key to .env.local first."
    );
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

async function allUsers(): Promise<UserRecord[]> {
  const out: UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const res = await getAuth().listUsers(1000, pageToken);
    out.push(...res.users);
    pageToken = res.pageToken;
  } while (pageToken);
  return out;
}

async function main() {
  initAdmin();
  const users = await allUsers();
  const asJson = process.argv.includes("--json");

  if (asJson) {
    console.log(
      JSON.stringify(
        users.map((u) => ({
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          disabled: u.disabled,
          role: u.customClaims?.role ?? null,
          emailVerified: u.emailVerified,
          lastSignIn: u.metadata.lastSignInTime,
          createdAt: u.metadata.creationTime,
        })),
        null,
        2
      )
    );
  } else {
    console.log(`Total users: ${users.length}\n`);
    for (const u of users) {
      console.log(
        `${(u.email ?? "(no email)").padEnd(32)} role=${
          (u.customClaims?.role as string) ?? "—"
        }  ${u.disabled ? "[disabled]" : ""}  uid=${u.uid}`
      );
    }
  }
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
