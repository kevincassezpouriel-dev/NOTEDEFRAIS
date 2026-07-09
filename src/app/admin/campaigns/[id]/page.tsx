"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import StatTile from "@/components/StatTile";
import Timeline, { ActionItem } from "@/components/Timeline";

interface Asset {
  id: string;
  name: string;
  slug: string;
  type: string;
  channel: string | null;
  totalScans: number;
  totalConversions: number;
}
interface PostRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  aiGenerated: boolean;
  clicks: number;
  installs: number;
}
interface Learning {
  id: string;
  insight: string;
  evidence: string | null;
  weight: number;
}
interface CampaignDetail {
  id: string;
  name: string;
  objective: string | null;
  status: string;
  assets: Asset[];
  posts: PostRow[];
  actions: ActionItem[];
  learnings: Learning[];
  aggregate: { total: number; period: number; conversions: number };
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [c, setC] = useState<CampaignDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: "", objective: "" });

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/campaigns/${id}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setC(data);
      setDraft({ name: data.name, objective: data.objective ?? "" });
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(data: Record<string, unknown>) {
    const res = await fetch(`/api/admin/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setEditing(false);
      load();
    }
  }

  async function remove() {
    if (!c) return;
    if (!window.confirm(`Supprimer la campagne « ${c.name} » ? Ses QR codes et posts sont conservés (simplement détachés).`)) return;
    const res = await fetch(`/api/admin/campaigns/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/campaigns");
  }

  if (!c) return <p className="text-sm" style={{ color: "var(--text-muted)" }}>Chargement…</p>;

  const convRate = c.aggregate.total > 0 ? ((c.aggregate.conversions / c.aggregate.total) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/campaigns" className="text-sm" style={{ color: "var(--text-muted)" }}>
          ← Campagnes
        </Link>
        {editing ? (
          <input
            className="input !w-auto flex-1"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        ) : (
          <h1 className="text-xl font-semibold flex-1">{c.name}</h1>
        )}
        <select
          className="input !w-auto"
          value={c.status}
          onChange={(e) => patch({ status: e.target.value })}
        >
          <option value="active">Active</option>
          <option value="paused">En pause</option>
          <option value="archived">Archivée</option>
        </select>
        {editing ? (
          <button className="btn btn-primary" onClick={() => patch({ name: draft.name, objective: draft.objective })}>
            Enregistrer
          </button>
        ) : (
          <button className="btn btn-secondary" onClick={() => setEditing(true)}>
            Modifier
          </button>
        )}
      </div>

      {editing ? (
        <div className="card p-4">
          <label className="block text-xs font-medium mb-1">Objectif</label>
          <input
            className="input"
            value={draft.objective}
            onChange={(e) => setDraft({ ...draft, objective: e.target.value })}
            placeholder="Le but de cette campagne…"
          />
        </div>
      ) : (
        c.objective && (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            🎯 {c.objective}
          </p>
        )
      )}

      {/* KPI agrégés de la campagne */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Scans / clics (total)" value={c.aggregate.total} />
        <StatTile label="90 derniers jours" value={c.aggregate.period} />
        <StatTile label="Conversions" value={c.aggregate.conversions} />
        <StatTile label="Taux de conversion" value={`${convRate} %`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {/* Assets */}
        <div className="card p-4">
          <div className="flex items-center mb-3">
            <h2 className="text-sm font-semibold mr-auto">Assets (QR & liens)</h2>
            <Link href="/admin/qrcodes" className="text-xs underline" style={{ color: "var(--accent)" }}>
              + Ajouter
            </Link>
          </div>
          {c.assets.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Aucun asset. Rattachez un QR code ou un lien à cette campagne depuis
              l&apos;onglet « QR & liens ».
            </p>
          ) : (
            <ul className="space-y-2">
              {c.assets.map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-sm">
                  <span>{a.type === "link" ? "🔗" : "▣"}</span>
                  <Link href={`/admin/qrcodes/${a.id}`} className="font-medium underline">
                    {a.name}
                  </Link>
                  {a.channel && <span className="text-xs" style={{ color: "var(--text-muted)" }}>· {a.channel}</span>}
                  <span className="ml-auto tabular-nums" style={{ color: "var(--text-secondary)" }}>
                    {a.totalScans} scans · {a.totalConversions} conv.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Apprentissages */}
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3">🧠 Ce que l&apos;IA a appris</h2>
          {c.learnings.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Les enseignements apparaîtront ici au fil des analyses.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {c.learnings.map((l) => (
                <li key={l.id}>
                  <span className="font-medium">{l.insight}</span>
                  {l.evidence && (
                    <span className="text-xs block" style={{ color: "var(--text-muted)" }}>
                      {l.evidence}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Posts avec attribution */}
      <div className="card p-4">
        <div className="flex items-center mb-3">
          <h2 className="text-sm font-semibold mr-auto">Posts de la campagne</h2>
          <Link href="/admin/posts" className="text-xs underline" style={{ color: "var(--accent)" }}>
            + Rédiger / générer
          </Link>
        </div>
        {c.posts.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Aucun post rattaché.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs border-b" style={{ color: "var(--text-muted)", borderColor: "var(--grid)" }}>
                  <th className="py-2 pr-3 font-medium">Titre</th>
                  <th className="py-2 pr-3 font-medium">Statut</th>
                  <th className="py-2 pr-3 font-medium text-right">Clics</th>
                  <th className="py-2 font-medium text-right">Installs</th>
                </tr>
              </thead>
              <tbody>
                {c.posts.map((p) => (
                  <tr key={p.id} className="border-b" style={{ borderColor: "var(--grid)" }}>
                    <td className="py-2 pr-3">
                      <Link href={`/admin/posts/${p.id}`} className="underline">
                        {p.aiGenerated ? "✨ " : ""}{p.title}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {p.status === "published" ? "Publié" : p.status === "scheduled" ? "Programmé" : "Brouillon"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{p.clicks}</td>
                    <td className="py-2 text-right tabular-nums">{p.installs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Timeline d'actions */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold mb-3">Activité de la campagne</h2>
        <Timeline actions={c.actions} />
      </div>

      <div className="flex justify-end">
        <button className="btn btn-danger" onClick={remove}>
          Supprimer la campagne
        </button>
      </div>
    </div>
  );
}
