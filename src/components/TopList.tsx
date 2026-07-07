"use client";

/** Classement (pays, villes…) : barres horizontales en rampe séquentielle. */
export default function TopList({
  items,
  emptyLabel,
}: {
  items: { label: string; sublabel?: string; count: number }[];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {emptyLabel}
      </p>
    );
  }
  const max = items[0]?.count ?? 1;

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={`${item.label}|${item.sublabel ?? ""}`} className="text-sm">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="truncate font-medium">{item.label}</span>
            {item.sublabel && (
              <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                {item.sublabel}
              </span>
            )}
            <span className="ml-auto tabular-nums" style={{ color: "var(--text-secondary)" }}>
              {item.count.toLocaleString("fr-FR")}
            </span>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: "var(--grid)" }}>
            <div
              className="h-1.5 rounded-full"
              style={{
                width: `${Math.max((item.count / max) * 100, 2)}%`,
                background: "var(--seq-450)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
