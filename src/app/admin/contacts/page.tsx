"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CATEGORIES,
  PROPRIETAIRE_SOURCES,
  PROPRIETAIRE_STATUTS,
  labelOf,
  colorOf,
  typesPour,
} from "@/lib/crm";

interface ContactRow {
  id: string;
  nom: string;
  organisation: string | null;
  telephone: string | null;
  email: string | null;
  categorie: string;
  type: string;
  source: string;
  quartier: string | null;
  statut: string;
  tags: string | null;
  dateRelancePrevue: string | null;
  dateDerniereAction: string | null;
  accordEcrit: boolean;
  _count: { annonces: number; interactions: number };
}

const VIDE = {
  nom: "",
  categorie: "proprietaire",
  type: "proprietaire_particulier",
  source: "terrain",
  telephone: "",
  email: "",
  organisation: "",
  quartier: "",
  tags: "",
  briefRecherche: "",
};

/** Répertoire CRM : tous les contacts, quelle que soit leur catégorie. */
export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [categorie, setCategorie] = useState("");
  const [statut, setStatut] = useState("");
  const [q, setQ] = useState("");
  const [vue, setVue] = useState<"liste" | "pipeline">("liste");
  const [form, setForm] = useState({ ...VIDE });
  const [ouvert, setOuvert] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const p = new URLSearchParams();
    if (categorie) p.set("categorie", categorie);
    if (statut) p.set("statut", statut);
    if (q.trim()) p.set("q", q.trim());
    const res = await fetch(`/api/admin/contacts?${p}`, { cache: "no-store" });
    if (res.ok) setContacts(await res.json());
  }, [categorie, statut, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (res.ok) {
      setForm({ ...VIDE });
      setOuvert(false);
      load();
    } else {
      const d = await res.json().catch(() => null);
      setError(d?.error ?? "Erreur");
    }
  }

  const parStatut = useMemo(() => {
    const map = new Map<string, ContactRow[]>();
    for (const s of PROPRIETAIRE_STATUTS) map.set(s.value, []);
    for (const c of contacts) map.set(c.statut, [...(map.get(c.statut) ?? []), c]);
    return map;
  }, [contacts]);

  const enRetard = (d: string | null) => d != null && new Date(d) < new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="mr-auto">
          <h1 className="text-xl font-semibold">Contacts</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Propriétaires, partenaires, prescripteurs, agences — tout le répertoire terrain.
          </p>
        </div>
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--baseline)" }}>
          {(["liste", "pipeline"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVue(v)}
              className="px-3 py-1.5 text-sm capitalize"
              style={{
                background: vue === v ? "var(--accent)" : "transparent",
                color: vue === v ? "#fff" : "var(--text-secondary)",
                fontWeight: vue === v ? 600 : 450,
              }}
            >
              {v}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={() => setOuvert((o) => !o)}>
          + Nouveau contact
        </button>
      </div>

      {ouvert && (
        <form onSubmit={creer} className="card p-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-44">
              <label className="block text-xs font-medium mb-1">Nom *</label>
              <input className="input" value={form.nom} required
                onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </div>
            <div className="w-44">
              <label className="block text-xs font-medium mb-1">Catégorie</label>
              <select className="input" value={form.categorie}
                onChange={(e) => {
                  const c = e.target.value;
                  setForm({ ...form, categorie: c, type: typesPour(c)[0]?.value ?? "autre" });
                }}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>
            <div className="w-52">
              <label className="block text-xs font-medium mb-1">Type</label>
              <select className="input" value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {typesPour(form.categorie).map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="w-44">
              <label className="block text-xs font-medium mb-1">Source</label>
              <select className="input" value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}>
                {PROPRIETAIRE_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-40">
              <label className="block text-xs font-medium mb-1">Téléphone</label>
              <input className="input" value={form.telephone}
                onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
            </div>
            <div className="flex-1 min-w-44">
              <label className="block text-xs font-medium mb-1">E-mail</label>
              <input className="input" type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="flex-1 min-w-40">
              <label className="block text-xs font-medium mb-1">Organisation</label>
              <input className="input" placeholder="école, commerce, agence…" value={form.organisation}
                onChange={(e) => setForm({ ...form, organisation: e.target.value })} />
            </div>
            <div className="flex-1 min-w-32">
              <label className="block text-xs font-medium mb-1">Quartier</label>
              <input className="input" value={form.quartier}
                onChange={(e) => setForm({ ...form, quartier: e.target.value })} />
            </div>
          </div>
          {form.categorie === "proprietaire" && (
            <div>
              <label className="block text-xs font-medium mb-1">
                Brief de recherche — quel profil il cherche, et ce qui ne passerait pas
              </label>
              <textarea className="input" rows={2} value={form.briefRecherche}
                onChange={(e) => setForm({ ...form, briefRecherche: e.target.value })} />
            </div>
          )}
          {error && <p className="text-sm" style={{ color: "var(--critical)" }}>{error}</p>}
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Création…" : "Créer"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setOuvert(false)}>
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <input className="input !w-auto flex-1 min-w-56" placeholder="Rechercher un nom, une orga, un téléphone…"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input !w-auto" value={categorie} onChange={(e) => setCategorie(e.target.value)}>
          <option value="">Toutes catégories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
          ))}
        </select>
        <select className="input !w-auto" value={statut} onChange={(e) => setStatut(e.target.value)}>
          <option value="">Tous statuts</option>
          {PROPRIETAIRE_STATUTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {contacts.length} contact{contacts.length > 1 ? "s" : ""}
        </span>
      </div>

      {vue === "pipeline" ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {PROPRIETAIRE_STATUTS.map((s) => {
            const items = parStatut.get(s.value) ?? [];
            return (
              <div key={s.value} className="card p-3 shrink-0" style={{ width: 240 }}>
                <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: s.color }} />
                  {s.label} <span style={{ color: "var(--text-muted)" }}>({items.length})</span>
                </p>
                <div className="space-y-1.5">
                  {items.map((c) => (
                    <Link key={c.id} href={`/admin/contacts/${c.id}`}
                      className="block p-2 rounded-lg text-sm"
                      style={{ background: "var(--page)", border: "1px solid var(--border)" }}>
                      <span className="font-medium">{c.nom}</span>
                      <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                        {labelOf(CATEGORIES, c.categorie)}
                        {c._count.annonces > 0 && ` · ${c._count.annonces} annonce(s)`}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-4 overflow-x-auto">
          {contacts.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Aucun contact.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs border-b" style={{ color: "var(--text-muted)", borderColor: "var(--grid)" }}>
                  <th className="py-2 pr-3 font-medium">Contact</th>
                  <th className="py-2 pr-3 font-medium">Catégorie</th>
                  <th className="py-2 pr-3 font-medium">Statut</th>
                  <th className="py-2 pr-3 font-medium">Quartier</th>
                  <th className="py-2 pr-3 font-medium text-right">Annonces</th>
                  <th className="py-2 pr-3 font-medium">Relance</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id} className="border-b" style={{ borderColor: "var(--grid)" }}>
                    <td className="py-2.5 pr-3">
                      <Link href={`/admin/contacts/${c.id}`} className="font-medium hover:underline">
                        {c.nom}
                      </Link>
                      {c.organisation && (
                        <span className="block text-xs" style={{ color: "var(--text-muted)" }}>{c.organisation}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-xs">{labelOf(CATEGORIES, c.categorie)}</td>
                    <td className="py-2.5 pr-3">
                      <span className="text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1.5"
                        style={{ background: "var(--grid)" }}>
                        <span className="w-1.5 h-1.5 rounded-full inline-block"
                          style={{ background: colorOf(PROPRIETAIRE_STATUTS, c.statut) }} />
                        {labelOf(PROPRIETAIRE_STATUTS, c.statut)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {c.quartier ?? "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{c._count.annonces || "—"}</td>
                    <td className="py-2.5 pr-3 text-xs"
                      style={{ color: enRetard(c.dateRelancePrevue) ? "var(--critical)" : "var(--text-muted)" }}>
                      {c.dateRelancePrevue
                        ? new Date(c.dateRelancePrevue).toLocaleDateString("fr-FR")
                        : "—"}
                    </td>
                    <td className="py-2.5 text-right">
                      <Link href={`/admin/contacts/${c.id}`} className="btn btn-secondary !py-1">Ouvrir</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
