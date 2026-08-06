"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import Documents from "@/components/Documents";
import {
  CATEGORIES,
  CANDIDATURE_STATUTS,
  ANNONCE_STATUTS,
  INTERACTION_TYPES,
  PRIORITES,
  PROPRIETAIRE_SOURCES,
  PROPRIETAIRE_STATUTS,
  SENS,
  colorOf,
  labelOf,
  typesPour,
} from "@/lib/crm";

interface Candidature {
  id: string;
  nom: string;
  statut: string;
  scoreAffinite: number | null;
  scoreSuggere: number | null;
  createdAt: string;
}
interface Annonce {
  id: string;
  titre: string;
  slug: string;
  statut: string;
  loyer: number | null;
  candidatures: Candidature[];
  _count: { candidatures: number };
}
interface Interaction {
  id: string;
  type: string;
  sens: string;
  resume: string;
  createdAt: string;
}
interface Tache {
  id: string;
  titre: string;
  dueAt: string | null;
  priorite: string;
  done: boolean;
}
interface Fiche {
  id: string;
  nom: string;
  telephone: string | null;
  email: string | null;
  organisation: string | null;
  categorie: string;
  type: string;
  source: string;
  quartier: string | null;
  statut: string;
  tags: string | null;
  accordEcrit: boolean;
  accordPreuve: string | null;
  briefRecherche: string | null;
  notes: string | null;
  datePremierContact: string | null;
  dateRelancePrevue: string | null;
  annonces: Annonce[];
  interactions: Interaction[];
  taches: Tache[];
  documents: { id: string; type: string; nomFichier: string; url: string }[];
  journal: { id: string; title: string; detail: string | null; createdAt: string }[];
}

const iso = (d: string | null) => (d ? d.slice(0, 10) : "");

/** Fiche 360 : tout ce qui concerne un contact, sur un seul écran. */
export default function FicheContact({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [c, setC] = useState<Fiche | null>(null);
  const [reveal, setReveal] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [inter, setInter] = useState({ type: "appel", sens: "sortant", resume: "", relance: "" });
  const [tache, setTache] = useState({ titre: "", dueAt: "", priorite: "normale" });

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/contacts/${id}`, { cache: "no-store" });
    if (res.ok) setC(await res.json());
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(data: Record<string, unknown>, texte = "✓ Enregistré") {
    setBusy(true);
    const res = await fetch(`/api/admin/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setBusy(false);
    setMsg(res.ok ? { text: texte, error: false } : { text: "Erreur", error: true });
    if (res.ok) load();
  }

  async function ajouterInteraction(e: React.FormEvent) {
    e.preventDefault();
    if (!inter.resume.trim()) return;
    setBusy(true);
    await fetch(`/api/admin/contacts/${id}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: inter.type,
        sens: inter.sens,
        resume: inter.resume,
        ...(inter.relance ? { dateRelancePrevue: inter.relance } : {}),
      }),
    });
    setBusy(false);
    setInter({ type: "appel", sens: "sortant", resume: "", relance: "" });
    setMsg({ text: "✓ Échange enregistré", error: false });
    load();
  }

  async function ajouterTache(e: React.FormEvent) {
    e.preventDefault();
    if (!tache.titre.trim()) return;
    await fetch("/api/admin/taches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...tache, contactId: id }),
    });
    setTache({ titre: "", dueAt: "", priorite: "normale" });
    load();
  }

  async function supprimer() {
    if (!c) return;
    if (!window.confirm(`Supprimer ${c.nom} et tout son historique ?`)) return;
    const res = await fetch(`/api/admin/contacts/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/contacts");
  }

  if (!c) return <p className="text-sm" style={{ color: "var(--text-muted)" }}>Chargement…</p>;

  const candidatures = c.annonces.flatMap((a) =>
    a.candidatures.map((x) => ({ ...x, annonce: a.titre, annonceId: a.id }))
  );
  const masque = (v: string | null) => (v ? (reveal ? v : "•".repeat(Math.min(v.length, 10))) : "—");

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/contacts" className="text-sm" style={{ color: "var(--text-muted)" }}>
          ← Contacts
        </Link>
        <h1 className="text-xl font-semibold">{c.nom}</h1>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--grid)" }}>
          {labelOf(CATEGORIES, c.categorie)}
        </span>
        {c.accordEcrit && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--accent-soft)", color: "var(--good)" }}>
            ✓ accord écrit
          </span>
        )}
        <button className="btn btn-danger !py-1 ml-auto" onClick={supprimer}>Supprimer</button>
      </div>

      {msg && (
        <p className="text-sm" style={{ color: msg.error ? "var(--critical)" : "var(--good)" }}>{msg.text}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ---- Colonne gauche : identité & pilotage ---- */}
        <div className="space-y-4">
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Coordonnées</h2>
              <button className="text-xs underline" style={{ color: "var(--text-muted)" }}
                onClick={() => setReveal((r) => !r)}>
                {reveal ? "Masquer" : "Révéler"}
              </button>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Jamais exposées publiquement ni transmises aux candidats.
            </p>
            <div className="space-y-1.5 text-sm">
              <p>📞 {masque(c.telephone)}</p>
              <p>✉️ {masque(c.email)}</p>
              {c.organisation && <p>🏢 {c.organisation}</p>}
              {c.quartier && <p>📍 {c.quartier}</p>}
            </div>
            {reveal && c.telephone && (
              <div className="flex gap-2 pt-1">
                <a className="btn btn-secondary !py-1 text-xs" href={`tel:${c.telephone}`}>Appeler</a>
                <a className="btn btn-secondary !py-1 text-xs"
                  href={`https://wa.me/${c.telephone.replace(/[^0-9]/g, "")}`} target="_blank">WhatsApp</a>
              </div>
            )}
          </div>

          <div className="card p-4 space-y-3">
            <h2 className="text-sm font-semibold">Pilotage</h2>
            <div>
              <label className="block text-xs font-medium mb-1">Statut</label>
              <select className="input" value={c.statut} onChange={(e) => patch({ statut: e.target.value })}>
                {PROPRIETAIRE_STATUTS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1">Catégorie</label>
                <select className="input" value={c.categorie}
                  onChange={(e) => patch({ categorie: e.target.value, type: typesPour(e.target.value)[0]?.value })}>
                  {CATEGORIES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1">Type</label>
                <select className="input" value={c.type} onChange={(e) => patch({ type: e.target.value })}>
                  {typesPour(c.categorie).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1">Source</label>
                <select className="input" value={c.source} onChange={(e) => patch({ source: e.target.value })}>
                  {PROPRIETAIRE_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1">Relance prévue</label>
                <input type="date" className="input" defaultValue={iso(c.dateRelancePrevue)}
                  onChange={(e) => patch({ dateRelancePrevue: e.target.value || null }, "🗓️ Relance programmée")} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={c.accordEcrit}
                onChange={(e) => patch({ accordEcrit: e.target.checked })} />
              Accord écrit obtenu
            </label>
            <div>
              <label className="block text-xs font-medium mb-1">Preuve de l&apos;accord</label>
              <textarea className="input" rows={2} defaultValue={c.accordPreuve ?? ""}
                placeholder="Copie du message d'accord…"
                onBlur={(e) => patch({ accordPreuve: e.target.value })} />
            </div>
          </div>

          <div className="card p-4 space-y-2">
            <h2 className="text-sm font-semibold">Tâches &amp; relances</h2>
            {c.taches.filter((t) => !t.done).length === 0 && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Rien à faire.</p>
            )}
            {c.taches.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={t.done}
                  onChange={async (e) => {
                    await fetch(`/api/admin/taches/${t.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ done: e.target.checked }),
                    });
                    load();
                  }} />
                <span style={{ textDecoration: t.done ? "line-through" : undefined, color: t.done ? "var(--text-muted)" : undefined }}>
                  {t.titre}
                </span>
                {t.dueAt && (
                  <span className="text-xs ml-auto"
                    style={{ color: new Date(t.dueAt) < new Date() && !t.done ? "var(--critical)" : "var(--text-muted)" }}>
                    {new Date(t.dueAt).toLocaleDateString("fr-FR")}
                  </span>
                )}
              </div>
            ))}
            <form onSubmit={ajouterTache} className="flex gap-1.5 pt-1">
              <input className="input flex-1" placeholder="Nouvelle tâche…" value={tache.titre}
                onChange={(e) => setTache({ ...tache, titre: e.target.value })} />
              <input type="date" className="input !w-36" value={tache.dueAt}
                onChange={(e) => setTache({ ...tache, dueAt: e.target.value })} />
              <select className="input !w-24" value={tache.priorite}
                onChange={(e) => setTache({ ...tache, priorite: e.target.value })}>
                {PRIORITES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <button className="btn btn-secondary !py-1">+</button>
            </form>
          </div>
        </div>

        {/* ---- Colonne centrale : brief, annonces, candidatures ---- */}
        <div className="space-y-4 lg:col-span-2">
          {c.categorie === "proprietaire" && (
            <div className="card p-4" style={{ borderLeft: "3px solid var(--accent)" }}>
              <h2 className="text-sm font-semibold mb-1">🎯 Brief de recherche</h2>
              <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
                Ce qu&apos;il cherche comme personne — c&apos;est ce qui alimente le score d&apos;affinité.
              </p>
              <textarea className="input" rows={4} defaultValue={c.briefRecherche ?? ""}
                placeholder="Ex. : cherche quelqu'un de calme et propre, non-fumeur, plutôt étudiant, pas de fêtes…"
                onBlur={(e) => patch({ briefRecherche: e.target.value })} />
            </div>
          )}

          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-semibold">Annonces ({c.annonces.length})</h2>
              {c.categorie === "proprietaire" && (
                <Link href={`/admin/annonces?proprietaireId=${c.id}`} className="btn btn-secondary !py-1 text-xs">
                  + Créer une annonce
                </Link>
              )}
            </div>
            {c.annonces.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Aucune annonce.</p>
            ) : (
              c.annonces.map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-2 border-t" style={{ borderColor: "var(--grid)" }}>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/annonces/${a.id}`} className="font-medium text-sm hover:underline">{a.titre}</Link>
                    <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                      {a.loyer ? `${a.loyer} €` : "—"} · {a._count.candidatures} candidature(s)
                    </span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "var(--grid)", color: colorOf(ANNONCE_STATUTS, a.statut) }}>
                    {labelOf(ANNONCE_STATUTS, a.statut)}
                  </span>
                </div>
              ))
            )}
          </div>

          {candidatures.length > 0 && (
            <div className="card p-4">
              <h2 className="text-sm font-semibold mb-2">
                Candidatures reçues ({candidatures.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {candidatures.map((x) => (
                      <tr key={x.id} className="border-b" style={{ borderColor: "var(--grid)" }}>
                        <td className="py-2 pr-3">
                          <Link href={`/admin/candidatures?annonceId=${x.annonceId}`} className="font-medium hover:underline">
                            {x.nom}
                          </Link>
                          <span className="block text-xs" style={{ color: "var(--text-muted)" }}>{x.annonce}</span>
                        </td>
                        <td className="py-2 pr-3 text-xs">
                          {x.scoreAffinite ? "★".repeat(x.scoreAffinite) : `~${x.scoreSuggere ?? "?"}/5`}
                        </td>
                        <td className="py-2 text-right">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--grid)" }}>
                            {labelOf(CANDIDATURE_STATUTS, x.statut)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Historique des échanges */}
          <div className="card p-4 space-y-3">
            <h2 className="text-sm font-semibold">Historique des échanges</h2>
            <form onSubmit={ajouterInteraction} className="space-y-2 p-3 rounded-lg" style={{ background: "var(--page)" }}>
              <div className="flex flex-wrap gap-2">
                <select className="input !w-32" value={inter.type}
                  onChange={(e) => setInter({ ...inter, type: e.target.value })}>
                  {INTERACTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
                </select>
                <select className="input !w-28" value={inter.sens}
                  onChange={(e) => setInter({ ...inter, sens: e.target.value })}>
                  {SENS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <input type="date" className="input !w-36" value={inter.relance} title="Programmer la prochaine relance"
                  onChange={(e) => setInter({ ...inter, relance: e.target.value })} />
              </div>
              <textarea className="input" rows={2} placeholder="Ce qui s'est dit…" value={inter.resume}
                onChange={(e) => setInter({ ...inter, resume: e.target.value })} />
              <button className="btn btn-primary !py-1 text-xs" disabled={busy || !inter.resume.trim()}>
                Enregistrer l&apos;échange
              </button>
            </form>
            {c.interactions.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Aucun échange enregistré.</p>
            ) : (
              <ol className="space-y-2">
                {c.interactions.map((i) => (
                  <li key={i.id} className="text-sm border-l-2 pl-3" style={{ borderColor: "var(--accent-soft)" }}>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {new Date(i.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} ·{" "}
                      {labelOf(INTERACTION_TYPES, i.type)} · {labelOf(SENS, i.sens)}
                    </span>
                    <p className="whitespace-pre-line">{i.resume}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <Documents contactId={c.id} titre="Pièces jointes du dossier" />

          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-2">Notes libres</h2>
            <textarea className="input" rows={3} defaultValue={c.notes ?? ""}
              onBlur={(e) => patch({ notes: e.target.value })} />
          </div>
        </div>
      </div>
    </div>
  );
}
