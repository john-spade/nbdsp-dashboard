import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { RegionalReport } from "@/components/analytics/regional-report";

export default async function ReportsPage() {
  const user = (await getSessionUser())!;

  // Page-level RBAC: Viewers cannot access reports.
  if (!can(user.role, "page:reports")) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">Regional Report</h1>
        <p className="text-sm text-slate-500">
          Birth-defect surveillance broken down across the 18 administrative regions
          of the Philippines — distribution diagram and detailed summary table.
        </p>
      </header>
      <RegionalReport />
    </div>
  );
}
