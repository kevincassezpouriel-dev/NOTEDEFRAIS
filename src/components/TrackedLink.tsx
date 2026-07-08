"use client";

import { useEffect, useState } from "react";

/** Bloc « lien de suivi » : URL trackée + copie en un clic. */
export default function TrackedLink({ slug }: { slug: string }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(process.env.NEXT_PUBLIC_APP_BASE_URL || window.location.origin);
  }, []);

  const base = origin ? `${origin.replace(/\/+$/, "")}/l/${slug}` : "";

  async function copy(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 1500);
  }

  const variants = [
    { label: "Lien principal", url: base },
    { label: "Variante story / bio", url: `${base}?utm_source=bio` },
    { label: "Variante e-mail", url: `${base}?utm_source=email` },
  ];

  return (
    <div className="space-y-3">
      {variants.map((v) => (
        <div key={v.label}>
          <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
            {v.label}
          </p>
          <div className="flex items-center gap-2">
            <code
              className="flex-1 text-xs px-3 py-2 rounded-lg break-all"
              style={{ background: "var(--page)", border: "1px solid var(--grid)" }}
            >
              {v.url}
            </code>
            <button
              type="button"
              className="btn btn-secondary !py-1.5 text-xs shrink-0"
              onClick={() => copy(v.url)}
            >
              {copied === v.url ? "✓ Copié" : "Copier"}
            </button>
          </div>
        </div>
      ))}
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Le paramètre <code>?utm_source=…</code> est enregistré comme source de
        trafic : créez autant de variantes que de placements pour comparer.
      </p>
    </div>
  );
}
