import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { listManagedUsers } from "@/lib/data/users";
import { UserManager } from "@/components/admin/user-manager";

/**
 * Server Component: fetches all users (Firebase Auth ⨝ Firestore profiles)
 * and renders the management UI. Admin only — analyst/viewer are redirected
 * (defence-in-depth with the edge middleware + sidebar filtering).
 */
export default async function UsersPage() {
  const user = (await getSessionUser())!;
  if (!can(user.role, "user:manage")) redirect("/dashboard");

  const users = await listManagedUsers();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
        <p className="text-sm text-slate-500">
          Create and manage operator accounts. There is no public registration —
          accounts are provisioned here by an administrator.
        </p>
      </header>
      <UserManager initialUsers={users} currentUid={user.uid} />
    </div>
  );
}
