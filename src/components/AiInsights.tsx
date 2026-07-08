"use client";

import { useState } from "react";
import { renderMarkdown } from "@/lib/markdown";

/** Carte « Analyse IA » : Claude croise les stats et dit ce qui marche. */
export default function AiInsights({ days }: { days: number }) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/ai/insights?days=${days}`, { cache: "no-store" });
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      setAnalysis(data.analysis);
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "L'analyse a échoué.");
    }
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-sm font-semibold mr-auto">✨ Analyse IA de l&apos;audience</h2>
        <button onClick={run} className="btn btn-primary !py-1.5 text-xs" disabled={loading}>
          {loading ? "Analyse en cours… (~30 s)" : analysis ? "Relancer" : "Analyser mes données"}
        </button>
      </div>

      {!analysis && !error && !loading && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Claude croise vos scans, appareils, villes, sources de trafic et
          conversions par campagne, puis vous dit ce qui fonctionne, ce qui ne
          fonctionne pas, et quoi faire pour faire croître MINGGLE.
        </p>
      )}
      {error && (
        <p className="text-sm" style={{ color: "var(--critical)" }}>
          {error}
        </p>
      )}
      {analysis && (
        <div
          className="text-sm leading-relaxed space-y-3
            [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-1
            [&_ul]:list-disc [&_ul]:pl-5"
          style={{ color: "var(--text-secondary)" }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(analysis) }}
        />
      )}
    </div>
  );
}
