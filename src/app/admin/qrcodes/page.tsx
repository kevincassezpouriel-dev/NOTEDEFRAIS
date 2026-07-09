"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface QrRow {
  id: string;
  name: string;
  slug: string;
  type: string;
  channel: string | null;
  active: boolean;
  createdAt: string;
  totalScans: number;
  totalConversions: number;
}

interface CampaignOption {
  id: string;
  name: string;
}

export default function QrCodesPage() {
  const [qrcodes, setQrcodes] = useState<QrRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [type, setType] = useState<"qr" | "link">("qr");
  const [channel, setChannel] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [res, campRes] = await Promise.all([
      fetch("/api/admin/qrcodes", { cache: "no-store" }),
      fetch("/api/admin/campaigns", { cache: "no-store" }),
    ]);
    if (res.ok) setQrcodes(await res.json());
    if (campRes.ok) setCampaigns(await campRes.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const res = await fetch("/api/admin/qrcodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        slug: slug || undefined,
        type,
        channel: channel || undefined,
        campaignId: campaignId || undefined,
      }),
    });
    setCreating(false);
    if (res.ok) {
      setName("");
      setSlug("");
      setChannel("");
      load();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Erreur lors de la création");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Campagnes — QR codes &amp; liens de suivi</h1>

      <form onSubmit={create} className="card p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" htmlFor="qr-type">
            Type
          </label>
          <select
            id="qr-type"
            className="input !w-auto"
            value={type}
            onChange={(e) => setType(e.target.value as "qr" | "link")}
          >
            <option value="qr">▣ QR code (support imprimé)</option>
            <option value="link">🔗 Lien de suivi (bio, e-mail…)</option>
          </select>
        </div>
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium mb-1" htmlFor="qr-name">
            Nom de la campagne
          </label>
          <input
            id="qr-name"
            className="input"
            placeholder="Ex. : Flyer Paris, Bio Instagram, Newsletter…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="w-40">
          <label className="block text-xs font-medium mb-1" htmlFor="qr-channel">
            Canal (optionnel)
          </label>
          <input
            id="qr-channel"
            className="input"
            placeholder="instagram, flyer…"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          />
        </div>
        <div className="w-40">
          <label className="block text-xs font-medium mb-1" htmlFor="qr-slug">
            Slug (optionnel)
          </label>
          <input
            id="qr-slug"
            className="input"
            placeholder="flyer-paris"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
          />
        </div>
        {campaigns.length > 0 && (
          <div className="w-48">
            <label className="block text-xs font-medium mb-1" htmlFor="qr-campaign">
              Campagne (optionnel)
            </label>
            <select
              id="qr-campaign"
              className="input"
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
            >
              <option value="">Aucune</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <button type="submit" className="btn btn-primary" disabled={creating}>
          {creating ? "Création…" : "+ Créer"}
        </button>
        {error && (
          <p className="w-full text-sm" style={{ color: "var(--critical)" }}>
            {error}
          </p>
        )}
      </form>

      <div className="card p-4">
        {qrcodes.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Aucun QR code pour le moment. Créez-en un ci-dessus — chaque campagne
            (flyer, salon, réseau social…) a son propre QR code et ses propres
            statistiques.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-xs border-b"
                  style={{ color: "var(--text-muted)", borderColor: "var(--grid)" }}
                >
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Nom</th>
                  <th className="py-2 pr-3 font-medium">Canal</th>
                  <th className="py-2 pr-3 font-medium">URL trackée</th>
                  <th className="py-2 pr-3 font-medium text-right">Scans</th>
                  <th className="py-2 pr-3 font-medium text-right">Conversions</th>
                  <th className="py-2 pr-3 font-medium">Statut</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {qrcodes.map((qr) => (
                  <tr key={qr.id} className="border-b" style={{ borderColor: "var(--grid)" }}>
                    <td className="py-2.5 pr-3">{qr.type === "link" ? "🔗" : "▣"}</td>
                    <td className="py-2.5 pr-3 font-medium">{qr.name}</td>
                    <td className="py-2.5 pr-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {qr.channel ?? "—"}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs">
                      /{qr.type === "link" ? "l" : "r"}/{qr.slug}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {qr.totalScans.toLocaleString("fr-FR")}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {qr.totalConversions.toLocaleString("fr-FR")}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: qr.active ? "var(--grid)" : "transparent",
                          color: qr.active ? "var(--good)" : "var(--critical)",
                          border: qr.active ? "none" : "1px solid var(--critical)",
                        }}
                      >
                        {qr.active ? "Actif" : "Désactivé"}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <Link href={`/admin/qrcodes/${qr.id}`} className="btn btn-secondary !py-1">
                        Gérer
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
