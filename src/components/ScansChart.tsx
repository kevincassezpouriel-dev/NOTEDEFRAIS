"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface DayPoint {
  date: string; // YYYY-MM-DD
  total: number;
  ios: number;
  android: number;
  other: number;
}

function shortDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum, p) => sum + Number(p.value ?? 0), 0);
  return (
    <div
      className="card p-3 text-xs"
      style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.12)" }}
    >
      <p className="font-semibold mb-1">{label ? shortDate(label) : ""}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm"
            style={{ background: p.color }}
          />
          <span style={{ color: "var(--text-secondary)" }}>{p.name}</span>
          <span className="ml-auto font-medium">{p.value}</span>
        </p>
      ))}
      <p className="mt-1 pt-1 border-t" style={{ borderColor: "var(--grid)" }}>
        Total <span className="font-semibold">{total}</span>
      </p>
    </div>
  );
}

export default function ScansChart({ data }: { data: DayPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--baseline)" }}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--grid)", opacity: 0.4 }} />
        <Legend
          iconType="square"
          iconSize={10}
          wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }}
        />
        <Bar
          dataKey="ios"
          name="iPhone / iPad"
          stackId="s"
          fill="var(--series-1)"
          stroke="var(--surface-1)"
          strokeWidth={1}
        />
        <Bar
          dataKey="android"
          name="Android"
          stackId="s"
          fill="var(--series-2)"
          stroke="var(--surface-1)"
          strokeWidth={1}
        />
        <Bar
          dataKey="other"
          name="Autres"
          stackId="s"
          fill="var(--text-muted)"
          stroke="var(--surface-1)"
          strokeWidth={1}
          radius={[2, 2, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
