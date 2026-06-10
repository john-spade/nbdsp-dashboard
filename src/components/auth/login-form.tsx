"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase/client";
import { apiSend } from "@/lib/api/client";
import { defaultRouteFor, isRole } from "@/lib/auth/rbac";

/**
 * Auth flow (client side):
 *  1. signInWithEmailAndPassword (Firebase Auth)
 *  2. getIdToken() → POST /api/auth/session → httpOnly cookie minted server-side
 *  3. redirect to the protected app
 */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(getClientAuth(), email, password);
      const idToken = await cred.user.getIdToken();
      const { role } = await apiSend<{ ok: true; role: string }>(
        "/api/auth/session",
        "POST",
        { idToken }
      );
      // Honor an explicit ?next= (e.g. deep link), else land on the role's home.
      const next =
        params.get("next") || (isRole(role) ? defaultRouteFor(role) : "/dashboard");
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error && /auth\//.test(err.message)
          ? "Invalid email or password."
          : "Sign-in failed. Please try again."
      );
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-maroon-500 focus:ring-2 focus:ring-maroon-200"
          placeholder="you@doh.gov.ph"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Password
        </label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-maroon-500 focus:ring-2 focus:ring-maroon-200"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-maroon-600 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-700 disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
