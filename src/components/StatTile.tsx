export default function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="text-3xl font-semibold leading-tight">
        {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
      </p>
      {hint && (
        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}
