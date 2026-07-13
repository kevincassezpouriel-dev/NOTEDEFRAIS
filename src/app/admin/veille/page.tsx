"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Analysis {
  competitor: string;
  summary: string;
  whatWorks: { observation: string; why: string }[];
  postIdeas: { brief: string; angle: string; format: string }[];
}

/**
 * Veille concurrentielle : colle l'URL (page Instagram, site…) ou le nom
 * d'un concurrent → l'IA enquête via le web public, explique ce qui marche
 * chez lui et propose des posts adaptés à TA marque, générables en un clic.
 */
export default function VeillePage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setAnalysis(null);
    const res = await fetch("/api/admin/ai/competitor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input }),
    });
    setBusy(false);
    if (res.ok) {
      setAnalysis(await res.json());
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Erreur d'analyse");
    }
  }

  async function generateFrom(idea: Analysis["postIdeas"][number], i: number) {
    setGenerating(i);
    setError(null);
    const res = await fetch("/api/admin/ai/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brief: `${idea.brief} (Format recommandé : ${idea.format}. Inspiré d'une veille concurrentielle sur ${analysis?.competitor} — reprendre le MÉCANISME, pas le contenu.)`,
      }),
    });
    setGenerating(null);
    if (res.ok) {
      const post = await res.json();
      router.push(`/admin/posts/${post.id}`);
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Erreur de génération");
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold">Veille concurrentielle</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Colle l&apos;URL d&apos;un concurrent (page Instagram, TikTok, site…) ou son nom.
          L&apos;IA enquête via le web public — contenus, presse, avis, classements —,
          explique <strong>ce qui marche chez lui et pourquoi</strong>, puis propose des
          posts adaptés à ta marque. (Les statistiques privées d&apos;Instagram ne sont
          pas accessibles : l&apos;analyse croise tout ce qui est public.)
        </p>
      </div>

      <form onSubmit={analyze} className="card p-4 flex flex-wrap gap-3">
        <input
          className="input flex-1 min-w-64"
          placeholder="https://www.instagram.com/concurrent — ou « Nom du concurrent »"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          required
        />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Enquête en cours… (~1 min)" : "🕵️ Analyser"}
        </button>
      </form>

      {error && (
        <p className="text-sm" style={{ color: "var(--critical)" }}>{error}</p>
      )}

      {analysis && (
        <>
          <div className="card p-5 space-y-2">
            <h2 className="text-sm font-semibold">📋 {analysis.competitor} — synthèse</h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {analysis.summary}
            </p>
          </div>

          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold">✅ Ce qui marche chez lui (et pourquoi)</h2>
            {analysis.whatWorks.map((w, i) => (
              <div key={i} className="text-sm">
                <p className="font-medium">{w.observation}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  → {w.why}
                </p>
              </div>
            ))}
          </div>

          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold">💡 Posts proposés pour ta marque</h2>
            {analysis.postIdeas.map((idea, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-3 border-t pt-3 first:border-t-0 first:pt-0"
                style={{ borderColor: "var(--grid)" }}
              >
                <div className="flex-1 min-w-56">
                  <p className="text-sm font-medium">{idea.angle}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {idea.brief}
                  </p>
                  <span
                    className="inline-block text-xs px-2 py-0.5 rounded-full mt-1"
                    style={{ background: "var(--grid)", color: "var(--text-secondary)" }}
                  >
                    {idea.format}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={generating !== null}
                  onClick={() => generateFrom(idea, i)}
                >
                  {generating === i ? "Génération…" : "✨ Générer ce post"}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
