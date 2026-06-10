"use client";

import { createContext, useContext } from "react";
import type { Role } from "@/lib/auth/rbac";

export interface ClientUser {
  uid: string;
  email: string | null;
  role: Role;
  name: string | null;
}

const SessionContext = createContext<ClientUser | null>(null);

/** Seeded by the protected server layout so client pages can read the role. */
export function SessionProvider({
  user,
  children,
}: {
  user: ClientUser;
  children: React.ReactNode;
}) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSession(): ClientUser {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
