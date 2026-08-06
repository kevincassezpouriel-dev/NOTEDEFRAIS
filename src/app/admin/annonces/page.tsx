"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ANNONCE_STATUTS, colorOf, labelOf } from "@/lib/crm";

interface AnnonceRow {
  id: string;
  titre: string;
  slug: string;
  statut: string;
  loyer: number | null;
  charges: number | null;
  quartier: string | null;
  referenceExterne: string | null;
  createdAt: string;
  proprietaire: { id: string; nom: string };
  qrCode: { id: string; slug: string } | null;
  _count: { candidatures: number };
}

interface ContactOption {
  id: string;
  nom: string;
  categorie: string;
}

export default function AnnoncesPage() {
  const [annonces, setAnnonces] = useState<AnnonceRow[]>([]);
  const [proprios, setProprios] = useState<ContactOption[]>([]);
  const [statut, setStatut] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    proprietaireId: "",
    titre: "",
    quartier: "",
    loyer: "",
    charges: "",
    surfaceChambre: "",
    nbColocataires: "",
    dateDispo: "",
    referenceExterne: "",
    description: "",
  });

  const load = useCallback(async () => {
    const [aRes, pRes] = await Promise.all([
      fetch(`/api/admin/annonces${statut ? `?statut=${statut}` : ""}`, { cache: "no-store" }),
      fetch("/api/admin/contacts?categorie=proprietaire", { cache: "no-store" }),
    ]);
    if (aRes.ok) setAnnonces(await aRes.json());
    if (pRes.ok) setProprios(await pRes.json());
  }, [statut]);

  useEffect(() => {
    load();
    // Pré-sélection quand on arrive depuis une fiche propriétaire
    const p = new URLSearchParams(window.location.search).get("proprietaireId");
    if (p) {
      setForm((f) => ({ ...f, proprietaireId: p }));
      setOuvert(true);
    }
  }, [load]);

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/annonces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (res.ok) {
      const a = await res.json();
      window.location.href = `/admin/annonces/${a.id}`;
    } else {
      const d = await res.json().catch(() => null);
      setError(d?.error ?? "Erreur");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="mr-auto">
          <h1 className="text-xl font-semibold">Annonces</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Chaque annonce publiée reçoit son QR/lien tracké : on sait quel flyer amène les candidats.
          </p>
        </div>
        <select className="input !w-auto" value={statut} onChange={(e) => setStatut(e.target.value)}>
          <option value="">Tous statuts</option>
          {ANNONCE_STATUTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={() => setOuvert((o) => !o)}>+ Nouvelle annonce</button>
      </div>

      {ouvert && (
        <form onSubmit={creer} className="card p-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-56">
              <label className="block text-xs font-medium mb-1">Propriétaire *</label>
              <select className="input" required value={form.proprietaireId}
                onChange={(e) => setForm({ ...form, proprietaireId: e.target.value })}>
                <option value="">— choisir —</option>
                {proprios.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </select>
              {proprios.length === 0 && (
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  Crée d&apos;abord un contact de catégorie « Propriétaire ».
                </p>
              )}
            </div>
            <div className="flex-[2] min-w-56">
              <label className="block text-xs font-medium mb-1">Titre *</label>
              <input className="input" required placeholder="Chambre 14 m² — coloc de 3, centre-ville"
                value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {([
              ["quartier", "Quartier", "text"],
              ["loyer", "Loyer (€)", "number"],
              ["charges", "Charges (€)", "number"],
              ["surfaceChambre", "Chambre (m²)", "number"],
              ["nbColocataires", "Nb colocs", "number"],
              ["dateDispo", "Disponible le", "date"],
            ] as const).map(([k, label, type]) => (
              <div key={k} className="flex-1 min-w-32">
                <label className="block text-xs font-medium mb-1">{label}</label>
                <input type={type} className="input" value={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-44">
              <label className="block text-xs font-medium mb-1">
                Référence du logement dans l&apos;app Minggle
              </label>
              <input className="input" placeholder="ID côté plateforme logement"
                value={form.referenceExterne}
                onChange={(e) => setForm({ ...form, referenceExterne: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Description</label>
            <textarea className="input" rows={3} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          {error && <p className="text-sm" style={{ color: "var(--critical)" }}>{error}</p>}
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={busy}>{busy ? "Création…" : "Créer l'annonce"}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setOuvert(false)}>Annuler</button>
          </div>
        </form>
      )}

      <div className="card p-4 overflow-x-auto">
        {annonces.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Aucune annonce.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs border-b" style={{ color: "var(--text-muted)", borderColor: "var(--grid)" }}>
                <th className="py-2 pr-3 font-medium">Annonce</th>
                <th className="py-2 pr-3 font-medium">Propriétaire</th>
                <th className="py-2 pr-3 font-medium">Statut</th>
                <th className="py-2 pr-3 font-medium text-right">Loyer</th>
                <th className="py-2 pr-3 font-medium text-right">Candidatures</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {annonces.map((a) => (
                <tr key={a.id} className="border-b" style={{ borderColor: "var(--grid)" }}>
                  <td className="py-2.5 pr-3">
                    <Link href={`/admin/annonces/${a.id}`} className="font-medium hover:underline">{a.titre}</Link>
                    <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                      {a.quartier ?? "—"}
                      {a.referenceExterne && ` · réf. ${a.referenceExterne}`}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-xs">
                    <Link href={`/admin/contacts/${a.proprietaire.id}`} className="hover:underline">
                      {a.proprietaire.nom}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "var(--grid)", color: colorOf(ANNONCE_STATUTS, a.statut) }}>
                      {labelOf(ANNONCE_STATUTS, a.statut)}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{a.loyer ? `${a.loyer} €` : "—"}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{a._count.candidatures || "—"}</td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    <span className="inline-flex gap-1.5">
                      {a.statut === "en_ligne" && (
                        <a href={`/colocations/${a.slug}`} target="_blank" className="btn btn-secondary !py-1">Voir ↗</a>
                      )}
                      <Link href={`/admin/annonces/${a.id}`} className="btn btn-secondary !py-1">Éditer</Link>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
