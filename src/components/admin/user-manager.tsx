"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { apiSend } from "@/lib/api/client";
import { ROLES, type Role } from "@/lib/auth/rbac";
import type { ManagedUser } from "@/lib/data/users";

function roleTone(role: Role): "maroon" | "blue" | "gold" | "slate" {
  if (role === "admin") return "maroon";
  if (role === "encoder") return "blue";
  if (role === "analyst") return "gold";
  return "slate"; // viewer
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export function UserManager({
  initialUsers,
  currentUid,
}: {
  initialUsers: ManagedUser[];
  currentUid: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  async function toggleDisabled(u: ManagedUser) {
    setBusyUid(u.uid);
    try {
      await apiSend(`/api/admin/users/${u.uid}`, "PATCH", { disabled: !u.disabled });
      toast(`${u.email} ${u.disabled ? "enabled" : "disabled"}.`, "success");
      router.refresh();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusyUid(null);
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg bg-maroon-600 px-4 py-2 text-sm font-semibold text-white hover:bg-maroon-700"
        >
          + Add User
        </button>
      </div>

      <Card className="p-0">
        {initialUsers.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No users yet" hint="Create the first account above." />
          </div>
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {initialUsers.map((u) => (
                  <tr key={u.uid} className="border-b border-slate-100">
                    <td className="px-5 py-3 font-medium text-slate-700">
                      {u.email ?? "—"}
                      {u.uid === currentUid && (
                        <span className="ml-2 text-xs text-slate-400">(you)</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={roleTone(u.role)}>{u.role}</Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{fmtDate(u.createdAt)}</td>
                    <td className="px-5 py-3">
                      <Badge tone={u.disabled ? "red" : "green"}>
                        {u.disabled ? "Disabled" : "Enabled"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        disabled={u.uid === currentUid || busyUid === u.uid}
                        onClick={() => toggleDisabled(u)}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-maroon-400 hover:text-maroon-700 disabled:opacity-40"
                      >
                        {busyUid === u.uid ? "…" : u.disabled ? "Enable" : "Disable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {open && (
        <AddUserModal
          onClose={() => setOpen(false)}
          onCreated={(email) => {
            setOpen(false);
            toast(`User ${email} created.`, "success");
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function AddUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await apiSend("/api/admin/users", "POST", { email, password, role });
      onCreated(email);
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-slate-800">Add User</h2>
        <p className="mb-4 text-sm text-slate-500">
          Provision a new operator account with a temporary password.
        </p>

        <div className="space-y-3">
          <Field label="Email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="user@doh.gov.ph"
            />
          </Field>
          <Field label="Temporary password">
            <input
              type="text"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="At least 6 characters"
            />
          </Field>
          <Field label="Role">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="input capitalize"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {error && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-400"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-maroon-600 px-4 py-2 text-sm font-semibold text-white hover:bg-maroon-700 disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create user"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
