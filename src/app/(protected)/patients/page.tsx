"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePatients } from "@/lib/api/hooks";
import { useSession } from "@/components/auth/session-context";
import { can } from "@/lib/auth/rbac";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
} from "@/components/ui/primitives";

/** City with region fallback so we never render a bare em-dash. */
function locality(city: string | null, region: string | null): string {
  return city || region || "—";
}

export default function PatientsPage() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = usePatients();
  const { role } = useSession();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("all");

  const regions = useMemo(() => {
    const set = new Set((data?.patients ?? []).map((p) => p.region).filter(Boolean));
    return ["all", ...Array.from(set as Set<string>)];
  }, [data]);

  const rows = useMemo(() => {
    let list = data?.patients ?? [];
    if (region !== "all") list = list.filter((p) => p.region === region);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (p) =>
          p.caseId.toLowerCase().includes(q) ||
          (p.mrn ?? "").toLowerCase().includes(q) ||
          p.lastName.toLowerCase().includes(q) ||
          p.firstName.toLowerCase().includes(q) ||
          p.middleName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, query, region]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Patients</h1>
          <p className="text-sm text-slate-500">
            Registry of surveilled neonates and their reported findings.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Case ID or name…"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-maroon-500 focus:ring-2 focus:ring-maroon-200"
          />
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-maroon-500"
          >
            {regions.map((r) => (
              <option key={r} value={r}>
                {r === "all" ? "All regions" : r}
              </option>
            ))}
          </select>
          {can(role, "patient:write") && (
            <Link
              href="/patients/new"
              className="whitespace-nowrap rounded-lg bg-maroon-600 px-4 py-2 text-sm font-semibold text-white hover:bg-maroon-700"
            >
              + Add Patient
            </Link>
          )}
        </div>
      </header>

      {isError ? (
        <ErrorState message="Could not load patients." onRetry={() => refetch()} />
      ) : isLoading ? (
        <Card>
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-6" />
            ))}
          </div>
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No patients match your filters"
          hint="Try clearing the search or region filter."
        />
      ) : (
        <Card className="overflow-x-auto p-0 scroll-thin">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Case ID</th>
                <th className="px-4 py-3">Last Name</th>
                <th className="px-4 py-3">First Name</th>
                <th className="px-4 py-3">Middle Name</th>
                <th className="px-4 py-3">Sex</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3">Region</th>
                <th className="px-4 py-3">Locality</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/patients/${p.id}`)}
                  className="cursor-pointer border-b border-slate-100 hover:bg-maroon-50/40"
                >
                  <td className="px-4 py-3 font-semibold text-maroon-700">
                    <Link
                      href={`/patients/${p.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:underline"
                    >
                      {p.caseId}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.lastName}</td>
                  <td className="px-4 py-3 text-slate-600">{p.firstName}</td>
                  <td className="px-4 py-3 text-slate-600">{p.middleName}</td>
                  <td className="px-4 py-3 capitalize text-slate-500">{p.sex}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {p.ageDays !== null ? `${p.ageDays}d` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{p.region ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{locality(p.city, p.region)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={p.active ? "green" : "slate"}>
                      {p.active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/patients/${p.id}`}
                      className="text-xs font-semibold text-maroon-600 hover:underline"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
