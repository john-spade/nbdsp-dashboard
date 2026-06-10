import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { AdminPanel } from "@/components/admin/admin-panel";

export default async function AdminPage() {
  const user = (await getSessionUser())!;
  if (!can(user.role, "page:admin")) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">Admin Panel</h1>
        <p className="text-sm text-slate-500">
          Data ingestion, pipeline health, and the security audit trail.
        </p>
      </header>
      <AdminPanel />
    </div>
  );
}
