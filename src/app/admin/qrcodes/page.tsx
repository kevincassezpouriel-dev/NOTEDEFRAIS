"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface QrRow {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  createdAt: string;
  totalScans: number;
  totalConversions: number;
}

export default function QrCodesPage() {
  const [qrcodes, setQrcodes] = useState<QrRow[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/qrcodes", { cache: "no-store" });
    if (res.ok) setQrcodes(await res.json());
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
      body: JSON.stringify({ name, slug: slug || undefined }),
    });
    setCreating(false);
    if (res.ok) {
      setName("");
      setSlug("");
      load();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Erreur lors de la création");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">QR codes / campagnes</h1>

      <form onSubmit={create} className="card p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium mb-1" htmlFor="qr-name">
            Nom de la campagne
          </label>
          <input
            id="qr-name"
            className="input"
            placeholder="Ex. : Flyer Paris, Salon 2026, Instagram…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium mb-1" htmlFor="qr-slug">
            Slug (optionnel — déduit du nom)
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
        <button type="submit" className="btn btn-primary" disabled={creating}>
          {creating ? "Création…" : "+ Créer un QR code"}
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
                  <th className="py-2 pr-3 font-medium">Nom</th>
                  <th className="py-2 pr-3 font-medium">URL de scan</th>
                  <th className="py-2 pr-3 font-medium text-right">Scans</th>
                  <th className="py-2 pr-3 font-medium text-right">Conversions</th>
                  <th className="py-2 pr-3 font-medium">Statut</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {qrcodes.map((qr) => (
                  <tr key={qr.id} className="border-b" style={{ borderColor: "var(--grid)" }}>
                    <td className="py-2.5 pr-3 font-medium">{qr.name}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs">/r/{qr.slug}</td>
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
