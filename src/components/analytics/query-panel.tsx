"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";
import { Card, CardTitle, EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { DEFECTS, PH_REGIONS, shortRegion } from "@/lib/fhir/reference-data";
import type { AnalyticsCase } from "@/lib/fhir/models";

interface QueryResult {
  rows: AnalyticsCase[];
  total: number;
  nextCursor: string | null;
}

/**
 * Supplemental data-querying panel — native, always present, beside the embed
 * (whether the main view is Looker or native). Server-side Firestore filtering
 * with URL-synced filters + cursor pagination (25/page).
 */
export function QueryPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Applied filters live in the URL (shareable). Draft filters are local.
  const appliedKey = searchParams.toString();
  const [regions, setRegions] = useState<string[]>(searchParams.getAll("region"));
  const [defects, setDefects] = useState<string[]>(searchParams.getAll("defect"));
  const [sex, setSex] = useState(searchParams.get("sex") ?? "");
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");

  // Cursor pagination (ephemeral, not in URL).
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const cursor = cursorStack[cursorStack.length - 1] ?? null;

  // Reset pagination whenever the applied filters change.
  useEffect(() => {
    setCursorStack([]);
  }, [appliedKey]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["case-query", appliedKey, cursor],
    queryFn: () => {
      const qs = new URLSearchParams(appliedKey);
      if (cursor) qs.set("cursor", cursor);
      return apiGet<QueryResult>(`/api/analytics/query?${qs.toString()}`);
    },
  });

  function toggle(list: string[], value: string, set: (v: string[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function apply() {
    const qs = new URLSearchParams();
    regions.forEach((r) => qs.append("region", r));
    defects.forEach((d) => qs.append("defect", d));
    if (sex) qs.set("sex", sex);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    router.push(`${pathname}?${qs.toString()}`);
  }

  function clear() {
    setRegions([]);
    setDefects([]);
    setSex("");
    setFrom("");
    setTo("");
    router.push(pathname);
  }

  const page = cursorStack.length + 1;

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <CardTitle>Supplemental Case Query</CardTitle>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
          server-side · Firestore
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Region multi-select */}
        <Checklist
          label="Region"
          options={PH_REGIONS as readonly string[]}
          selected={regions}
          onToggle={(v) => toggle(regions, v, setRegions)}
          format={shortRegion}
        />
        {/* Defect multi-select */}
        <Checklist
          label="Defect type"
          options={DEFECTS.map((d) => d.display)}
          selected={defects}
          onToggle={(v) => toggle(defects, v, setDefects)}
        />
        {/* Sex + date range */}
        <div className="space-y-3">
          <Field label="Sex">
            <select value={sex} onChange={(e) => setSex(e.target.value)} className="input">
              <option value="">Any</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </Field>
          <Field label="From (month)">
            <input type="month" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
          </Field>
          <Field label="To (month)">
            <input type="month" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
          </Field>
        </div>
        {/* Actions */}
        <div className="flex flex-col justify-end gap-2 md:col-span-2">
          <button
            onClick={apply}
            className="rounded-lg bg-maroon-600 px-4 py-2 text-sm font-semibold text-white hover:bg-maroon-700"
          >
            Apply filters
          </button>
          <button
            onClick={clear}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-400"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Results */}
      {isError ? (
        <ErrorState message="Query failed (a Firestore index may be needed)." onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6" />
          ))}
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-maroon-700">{data.total}</span> matching{" "}
            {data.total === 1 ? "case" : "cases"}
            {appliedKey ? " for the current filters" : " (all cases)"}.
          </p>

          {data.rows.length === 0 ? (
            <EmptyState title="No cases match these filters" />
          ) : (
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Case ID</th>
                    <th className="px-3 py-2">Region</th>
                    <th className="px-3 py-2">Defect</th>
                    <th className="px-3 py-2">ICD-10</th>
                    <th className="px-3 py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-maroon-50/40">
                      <td className="px-3 py-2 font-semibold text-maroon-700">
                        <Link href={`/patients/${r.patientId}`} className="hover:underline">
                          {r.caseId}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{r.region}</td>
                      <td className="px-3 py-2 text-slate-600">{r.defectLabel}</td>
                      <td className="px-3 py-2 text-slate-500">{r.icd10 || "—"}</td>
                      <td className="px-3 py-2 text-slate-500">{r.effectiveDate || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-400">Page {page} · 25 per page</span>
            <div className="flex gap-2">
              <button
                disabled={cursorStack.length === 0}
                onClick={() => setCursorStack((s) => s.slice(0, -1))}
                className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 disabled:opacity-40"
              >
                ← Prev
              </button>
              <button
                disabled={!data.nextCursor}
                onClick={() => data.nextCursor && setCursorStack((s) => [...s, data.nextCursor!])}
                className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

function Checklist({
  label,
  options,
  selected,
  onToggle,
  format,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
  format?: (v: string) => string;
}) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-slate-700">{label}</p>
      <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 scroll-thin">
        {options.map((opt) => (
          <label key={opt} className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={() => onToggle(opt)}
              className="accent-maroon-600"
            />
            {format ? format(opt) : opt}
          </label>
        ))}
      </div>
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
