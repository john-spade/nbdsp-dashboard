import "server-only";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { isRole, type Role } from "@/lib/auth/rbac";

/**
 * User account data layer.
 *
 * The source of truth for *authentication* is Firebase Auth; the `users`
 * Firestore collection mirrors the role + provenance (createdBy/createdAt)
 * for display and audit. This module joins the two.
 */

export interface ManagedUser {
  uid: string;
  email: string | null;
  role: Role;
  disabled: boolean;
  createdAt: string | null;
  createdBy: string | null;
  lastSignIn: string | null;
}

export async function listManagedUsers(): Promise<ManagedUser[]> {
  // 1. Pull all Auth users (paginated).
  const authUsers = [];
  let pageToken: string | undefined;
  do {
    const res = await adminAuth.listUsers(1000, pageToken);
    authUsers.push(...res.users);
    pageToken = res.pageToken;
  } while (pageToken);

  // 2. Pull profile docs in one read and index by uid.
  const profilesSnap = await adminDb.collection("users").get();
  const profiles = new Map(profilesSnap.docs.map((d) => [d.id, d.data()]));

  // 3. Join. Role comes from custom claims (authoritative), falling back to
  //    the profile doc, then "viewer".
  return authUsers.map((u) => {
    const profile = profiles.get(u.uid);
    const claimRole = u.customClaims?.role;
    const role: Role = isRole(claimRole)
      ? claimRole
      : isRole(profile?.role)
        ? (profile!.role as Role)
        : "viewer";
    return {
      uid: u.uid,
      email: u.email ?? null,
      role,
      disabled: u.disabled,
      createdAt:
        (profile?.createdAt as string | undefined) ??
        u.metadata.creationTime ??
        null,
      createdBy: (profile?.createdBy as string | undefined) ?? null,
      lastSignIn: u.metadata.lastSignInTime ?? null,
    };
  });
}

export async function createManagedUser(input: {
  email: string;
  password: string;
  role: Role;
  createdBy: string;
}): Promise<ManagedUser> {
  const user = await adminAuth.createUser({
    email: input.email,
    password: input.password,
    emailVerified: false,
    disabled: false,
  });
  await adminAuth.setCustomUserClaims(user.uid, { role: input.role });

  const createdAt = new Date().toISOString();
  await adminDb.collection("users").doc(user.uid).set({
    uid: user.uid,
    email: input.email,
    role: input.role,
    createdAt,
    createdBy: input.createdBy,
  });

  return {
    uid: user.uid,
    email: input.email,
    role: input.role,
    disabled: false,
    createdAt,
    createdBy: input.createdBy,
    lastSignIn: null,
  };
}

export async function setUserDisabled(uid: string, disabled: boolean): Promise<void> {
  await adminAuth.updateUser(uid, { disabled });
  await adminDb.collection("users").doc(uid).set({ disabled }, { merge: true });
}
