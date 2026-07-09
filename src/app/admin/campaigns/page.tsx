"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface CampaignRow {
  id: string;
  name: string;
  objective: string | null;
  status: string;
  assetCount: number;
  postCount: number;
  createdAt: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "var(--good)" },
  paused: { label: "En pause", color: "var(--text-muted)" },
  archived: { label: "Archivée", color: "var(--text-muted)" },
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/campaigns", { cache: "no-store" });
    if (res.ok) setCampaigns(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const res = await fetch("/api/admin/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, objective: objective || undefined }),
    });
    setCreating(false);
    if (res.ok) {
      setName("");
      setObjective("");
      load();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Erreur");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Campagnes</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Une campagne regroupe un objectif, ses QR codes et liens, ses posts et
          tout ce que l&apos;IA en apprend. C&apos;est votre unité de pilotage.
        </p>
      </div>

      <form onSubmit={create} className="card p-4 flex flex-wrap items-end gap-3">
        <div className="w-56">
          <label className="block text-xs font-medium mb-1" htmlFor="c-name">
            Nom de la campagne
          </label>
          <input
            id="c-name"
            className="input"
            placeholder="Lancement v2, Salon de Paris…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="flex-1 min-w-56">
          <label className="block text-xs font-medium mb-1" htmlFor="c-obj">
            Objectif (sert de contexte à l&apos;IA)
          </label>
          <input
            id="c-obj"
            className="input"
            placeholder="Ex. : maximiser les installs iOS à Paris avant le salon"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={creating}>
          {creating ? "Création…" : "+ Créer une campagne"}
        </button>
        {error && (
          <p className="w-full text-sm" style={{ color: "var(--critical)" }}>
            {error}
          </p>
        )}
      </form>

      {campaigns.length === 0 ? (
        <div className="card p-6">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Aucune campagne. Créez-en une ci-dessus, puis rattachez-lui des QR
            codes, des liens et des posts — vous verrez toute son activité et ses
            performances au même endroit.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {campaigns.map((c) => {
            const st = STATUS_LABELS[c.status] ?? STATUS_LABELS.active;
            return (
              <Link key={c.id} href={`/admin/campaigns/${c.id}`} className="card p-5 hover:opacity-90">
                <div className="flex items-start gap-2">
                  <h2 className="font-semibold flex-1">{c.name}</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: st.color, background: "var(--grid)" }}>
                    {st.label}
                  </span>
                </div>
                {c.objective && (
                  <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                    {c.objective}
                  </p>
                )}
                <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
                  {c.assetCount} asset(s) · {c.postCount} post(s)
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
