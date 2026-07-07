"use client";

/** Répartition des appareils : barre 100 % empilée + légende chiffrée.
 *  Ordre et couleurs des slots fixes (jamais réattribués selon le rang). */
const SLOTS: { key: string; label: string; color: string }[] = [
  { key: "iphone", label: "iPhone", color: "var(--series-1)" },
  { key: "ipad", label: "iPad", color: "var(--seq-250)" },
  { key: "android", label: "Android", color: "var(--series-2)" },
  { key: "windows", label: "Windows", color: "var(--series-3)" },
  { key: "mac", label: "Mac", color: "var(--series-4)" },
  { key: "linux", label: "Linux", color: "var(--series-5)" },
  { key: "other", label: "Autre", color: "var(--text-muted)" },
];

export default function DeviceSplit({ devices }: { devices: Record<string, number> }) {
  const total = Object.values(devices).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Aucun scan sur la période.
      </p>
    );
  }
  const present = SLOTS.filter((s) => (devices[s.key] ?? 0) > 0);

  return (
    <div>
      <div className="flex h-6 rounded-md overflow-hidden gap-[2px] mb-4">
        {present.map((s) => (
          <div
            key={s.key}
            title={`${s.label} : ${devices[s.key]} (${pct(devices[s.key], total)})`}
            style={{
              width: `${((devices[s.key] ?? 0) / total) * 100}%`,
              background: s.color,
              minWidth: 3,
            }}
          />
        ))}
      </div>
      <ul className="space-y-1.5 text-sm">
        {present.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ background: s.color }}
            />
            <span style={{ color: "var(--text-secondary)" }}>{s.label}</span>
            <span className="ml-auto tabular-nums font-medium">
              {(devices[s.key] ?? 0).toLocaleString("fr-FR")}
            </span>
            <span
              className="tabular-nums w-14 text-right"
              style={{ color: "var(--text-muted)" }}
            >
              {pct(devices[s.key], total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function pct(n: number | undefined, total: number): string {
  return `${(((n ?? 0) / total) * 100).toFixed(1)} %`;
}
