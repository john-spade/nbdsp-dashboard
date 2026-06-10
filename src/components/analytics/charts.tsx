"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SurveillanceMetrics } from "@/lib/fhir/models";
import { shortRegion } from "@/lib/fhir/reference-data";

const MAROON = "#7b1113";
const MAROON_LIGHT = "#b53a49";
const GOLD = "#e0b13a";
const PALETTE = [
  "#7b1113",
  "#b53a49",
  "#e0b13a",
  "#c4942a",
  "#560c0e",
  "#d05f6c",
  "#8a6d1f",
  "#a8323d",
];

/** 1. Cases per Region — horizontal bar, sorted desc, abbreviated labels. */
export function RegionBarChart({
  data,
  height = 300,
}: {
  data: SurveillanceMetrics["casesByRegion"];
  height?: number;
}) {
  const chartData = data.map((d) => ({ ...d, label: shortRegion(d.region) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ left: 8, right: 24, top: 8, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 11 }}
          width={130}
          interval={0}
        />
        <Tooltip
          cursor={{ fill: "#f8e9ea" }}
          labelFormatter={(_, p) => p?.[0]?.payload?.region ?? ""}
        />
        <Bar dataKey="count" name="Cases" fill={MAROON} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** 2. Monthly Trend — area-filled line, last 18 months. */
export function TrendAreaChart({ data }: { data: SurveillanceMetrics["monthlyTrend"] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ left: -10, right: 10, top: 10, bottom: 4 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={MAROON} stopOpacity={0.35} />
            <stop offset="100%" stopColor={MAROON} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
        <XAxis dataKey="month" tick={{ fontSize: 9 }} interval={1} angle={-30} textAnchor="end" height={48} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="count"
          name="Cases"
          stroke={MAROON}
          strokeWidth={2}
          fill="url(#trendFill)"
          dot={{ r: 2, fill: GOLD }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** 3. Defect Distribution — donut with legend + percentages. */
export function DefectDonutChart({
  data,
}: {
  data: SurveillanceMetrics["defectDistribution"];
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={95}
          paddingAngle={2}
          label={(e: { percent?: number }) => `${Math.round((e.percent ?? 0) * 100)}%`}
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          wrapperStyle={{ fontSize: 11, maxWidth: 160 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** 4. Cases by Sex — grouped bar (Male/Female) across top defects. */
export function SexGroupedBarChart({
  data,
}: {
  data: SurveillanceMetrics["casesBySexByDefect"];
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ left: -10, right: 10, top: 10, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
        <XAxis
          dataKey="defect"
          tick={{ fontSize: 9 }}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={70}
        />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip cursor={{ fill: "#f8e9ea" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="male" name="Male" fill={MAROON} radius={[3, 3, 0, 0]} />
        <Bar dataKey="female" name="Female" fill={GOLD} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export { MAROON, MAROON_LIGHT, GOLD };
