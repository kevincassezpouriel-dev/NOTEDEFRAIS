"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AjouterCandidat from "@/components/AjouterCandidat";
import Documents from "@/components/Documents";
import ModifierCandidat from "@/components/ModifierCandidat";
import {
  CANAUX,
  CANDIDATURE_STATUTS,
  GARANTS,
  INVITES,
  RYTHMES,
  STATUTS_PRO,
  labelOf,
} from "@/lib/crm";

interface Candidature {
  id: string;
  nom: string;
  email: string;
  telephone: string | null;
  statutPro: string;
  ecoleEmployeur: string | null;
  budgetMax: number | null;
  dateDispo: string | null;
  dureeSouhaitee: string | null;
  garant: string;
  rythme: string;
  menage: number;
  invites: string;
  fetes: number;
  fumeur: boolean;
  animaux: boolean;
  motivation: string;
  scoreAffinite: number | null;
  scoreSuggere: number | null;
  scoreRaisons: string | null;
  statut: string;
  campagneSource: string | null;
  origine: string;
  notesQualification: string | null;
  createdAt: string;
  annonce: {
    id: string;
    titre: string;
    loyer: number | null;
    charges: number | null;
    proprietaire: { id: string; nom: string; briefRecherche: string | null };
  };
  transmissions: { id: string; resultat: string }[];
}

/** File de qualification : brief du propriétaire face au profil du candidat. */
export default function CandidaturesPage() {
  const [items, setItems] = useState<Candidature[]>([]);
  const [statut, setStatut] = useState("a_qualifier");
  const [annonceId, setAnnonceId] = useState("");
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [canal, setCanal] = useState("whatsapp");

  const load = useCallback(async () => {
    const p = new URLSearchParams();
    if (statut) p.set("statut", statut);
    if (annonceId) p.set("annonceId", annonceId);
    const res = await fetch(`/api/admin/candidatures?${p}`, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as Candidature[];
      setItems(data);
      setI((prev) => Math.min(prev, Math.max(0, data.length - 1)));
    }
  }, [statut, annonceId]);

  useEffect(() => {
    const a = new URLSearchParams(window.location.search).get("annonceId");
    if (a) {
      setAnnonceId(a);
      setStatut("");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const c = items[i];

  const patch = useCallback(
    async (data: Record<string, unknown>, texte: string) => {
      if (!c) return;
      setBusy(true);
      const res = await fetch(`/api/admin/candidatures/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setBusy(false);
      setMsg(res.ok ? { text: texte, error: false } : { text: "Erreur", error: true });
      if (res.ok) load();
    },
    [c, load]
  );

  async function transmettre(force = false) {
    if (!c) return;
    setBusy(true);
    const res = await fetch("/api/admin/transmissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidatureId: c.id, canal, force }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg({ text: `🚀 ${c.nom} transmis à ${c.annonce.proprietaire.nom}`, error: false });
      load();
    } else {
      const d = await res.json().catch(() => null);
      if (d?.needsForce && window.confirm(`${d.error}\n\nTransmettre quand même ?`)) {
        transmettre(true);
        return;
      }
      setMsg({ text: d?.error ?? "Erreur", error: true });
    }
  }

  /** Message prêt à envoyer — jamais les coordonnées du candidat. */
  function messageProprio(): string {
    if (!c) return "";
    return [
      `Bonjour ${c.annonce.proprietaire.nom},`,
      ``,
      `J'ai un profil qui correspond bien à votre recherche pour « ${c.annonce.titre} » :`,
      ``,
      `• ${c.nom}, ${labelOf(STATUTS_PRO, c.statutPro).toLowerCase()}${c.ecoleEmployeur ? ` (${c.ecoleEmployeur})` : ""}`,
      `• Budget : ${c.budgetMax ?? "—"} € · Garant : ${labelOf(GARANTS, c.garant).toLowerCase()}`,
      `• Disponible : ${c.dateDispo ? new Date(c.dateDispo).toLocaleDateString("fr-FR") : "à préciser"}${c.dureeSouhaitee ? ` · ${c.dureeSouhaitee}` : ""}`,
      `• Rythme ${labelOf(RYTHMES, c.rythme).toLowerCase()}, ménage ${c.menage}/5, fêtes ${c.fetes}/5, invités : ${labelOf(INVITES, c.invites).toLowerCase()}`,
      `• ${c.fumeur ? "Fumeur" : "Non-fumeur"} · ${c.animaux ? "A un animal" : "Pas d'animal"}`,
      ``,
      `Sa motivation : « ${c.motivation.slice(0, 300)}${c.motivation.length > 300 ? "…" : ""} »`,
      ``,
      `Si le profil vous parle, je organise la visite. Dites-moi.`,
    ].join("\n");
  }

  const jauge = (label: string, v: number) => (
    <div className="flex items-center gap-2">
      <span className="text-xs w-16" style={{ color: "var(--text-muted)" }}>{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className="w-5 h-1.5 rounded-full"
            style={{ background: n <= v ? "var(--accent)" : "var(--grid)" }} />
        ))}
      </div>
      <span className="text-xs tabular-nums">{v}/5</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="mr-auto">
          <h1 className="text-xl font-semibold">File de qualification</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Le brief du propriétaire en face du profil : décide vite, transmets les meilleurs.
          </p>
        </div>
        <select className="input !w-auto" value={statut} onChange={(e) => { setStatut(e.target.value); setI(0); }}>
          <option value="">Toutes</option>
          {CANDIDATURE_STATUTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {annonceId && (
          <button className="btn btn-secondary !py-1 text-xs" onClick={() => { setAnnonceId(""); setI(0); }}>
            Retirer le filtre annonce
          </button>
        )}
        <span className="text-sm tabular-nums" style={{ color: "var(--text-muted)" }}>
          {items.length === 0 ? "0" : `${i + 1} / ${items.length}`}
        </span>
        <AjouterCandidat annonceIdParDefaut={annonceId || undefined} onAjoute={load} />
      </div>

      {msg && <p className="text-sm" style={{ color: msg.error ? "var(--critical)" : "var(--good)" }}>{msg.text}</p>}

      {!c ? (
        <div className="card p-8 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Rien à qualifier ici. 🎉
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Le brief attendu */}
            <div className="card p-4" style={{ borderLeft: "3px solid var(--accent)" }}>
              <h2 className="text-sm font-semibold mb-1">🎯 Ce que cherche {c.annonce.proprietaire.nom}</h2>
              <Link href={`/admin/annonces/${c.annonce.id}`} className="text-xs underline"
                style={{ color: "var(--text-muted)" }}>
                {c.annonce.titre} · {(c.annonce.loyer ?? 0) + (c.annonce.charges ?? 0)} € tout compris
              </Link>
              <p className="text-sm mt-3 whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>
                {c.annonce.proprietaire.briefRecherche || "Aucun brief renseigné — pense à le remplir sur la fiche du propriétaire."}
              </p>
            </div>

            {/* Le profil proposé */}
            <div className="card p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-sm font-semibold">{c.nom}</h2>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  reçu le {new Date(c.createdAt).toLocaleDateString("fr-FR")}
                  {c.campagneSource && ` · via ${c.campagneSource}`}
                  {c.origine === "manuel" && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full"
                      style={{ background: "var(--grid)", color: "var(--text-secondary)" }}>
                      saisie manuelle
                    </span>
                  )}
                </span>
              </div>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {labelOf(STATUTS_PRO, c.statutPro)}
                {c.ecoleEmployeur && ` · ${c.ecoleEmployeur}`}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span>💶 {c.budgetMax ?? "—"} €</span>
                <span>🛡️ garant : {labelOf(GARANTS, c.garant).toLowerCase()}</span>
                <span>📅 {c.dateDispo ? new Date(c.dateDispo).toLocaleDateString("fr-FR") : "—"}</span>
                {c.dureeSouhaitee && <span>⏳ {c.dureeSouhaitee}</span>}
              </div>
              <div className="space-y-1 pt-1">
                {jauge("Ménage", c.menage)}
                {jauge("Fêtes", c.fetes)}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span>🕐 {labelOf(RYTHMES, c.rythme)}</span>
                <span>👥 invités : {labelOf(INVITES, c.invites).toLowerCase()}</span>
                <span>{c.fumeur ? "🚬 fumeur" : "🚭 non-fumeur"}</span>
                <span>{c.animaux ? "🐾 animal" : "— sans animal"}</span>
              </div>
              <div className="pt-2">
                <p className="text-xs font-medium mb-1">Motivation</p>
                <p className="text-sm whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>
                  {c.motivation}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs pt-1 flex-wrap" style={{ color: "var(--text-muted)" }}>
                <a href={`mailto:${c.email}`} className="underline">{c.email}</a>
                {c.telephone && <a href={`tel:${c.telephone}`} className="underline">{c.telephone}</a>}
                {c.telephone && (
                  <a href={`https://wa.me/${c.telephone.replace(/[^0-9]/g, "")}`} target="_blank"
                    rel="noopener" className="underline">WhatsApp</a>
                )}
              </div>
              <div className="pt-1">
                <ModifierCandidat
                  key={c.id}
                  candidature={c}
                  onEnregistrer={(data) => patch(data, "✓ Profil corrigé")}
                />
              </div>
            </div>
          </div>

          {/* Décision */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <p className="text-xs font-medium mb-1">Score d&apos;affinité</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => patch({ scoreAffinite: n, statut: "qualifie" }, `Score ${n}/5 enregistré`)}
                      className="w-9 h-9 rounded-lg text-sm font-semibold"
                      style={{
                        background: (c.scoreAffinite ?? 0) >= n ? "var(--accent)" : "var(--page)",
                        color: (c.scoreAffinite ?? 0) >= n ? "#fff" : "var(--text-muted)",
                        border: "1px solid var(--border)",
                      }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              {c.scoreSuggere && (
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  <p className="font-medium mb-0.5">Suggestion automatique : {c.scoreSuggere}/5</p>
                  {(c.scoreRaisons ?? "").split("\n").filter(Boolean).slice(0, 4).map((r, k) => (
                    <p key={k}>{r}</p>
                  ))}
                </div>
              )}
              <div className="ml-auto flex items-end gap-2">
                <select className="input !w-auto" value={canal} onChange={(e) => setCanal(e.target.value)}>
                  {CANAUX.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
                <button className="btn btn-primary" disabled={busy} onClick={() => transmettre()}>
                  🚀 Transmettre
                </button>
                <button className="btn btn-secondary" disabled={busy}
                  onClick={() => patch({ statut: "ecarte" }, "Candidat écarté")}>
                  Écarter
                </button>
              </div>
            </div>

            <textarea className="input" rows={2} placeholder="Notes de qualification…"
              defaultValue={c.notesQualification ?? ""}
              onBlur={(e) => patch({ notesQualification: e.target.value }, "✓ Notes enregistrées")} />

            <details>
              <summary className="text-xs cursor-pointer" style={{ color: "var(--text-muted)" }}>
                Message prêt à envoyer au propriétaire
              </summary>
              <textarea className="input font-mono text-xs mt-2" rows={12} readOnly value={messageProprio()} />
              <button className="btn btn-secondary !py-1 text-xs mt-2"
                onClick={() => navigator.clipboard.writeText(messageProprio())}>
                Copier le message
              </button>
            </details>

            <div className="flex items-center gap-2 pt-1">
              <button className="btn btn-secondary !py-1" disabled={i === 0} onClick={() => setI(i - 1)}>← Précédent</button>
              <button className="btn btn-secondary !py-1" disabled={i >= items.length - 1} onClick={() => setI(i + 1)}>
                Suivant →
              </button>
              <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>
                Statut : {labelOf(CANDIDATURE_STATUTS, c.statut)}
                {c.transmissions.length > 0 && ` · ${c.transmissions.length} transmission(s)`}
              </span>
            </div>
          </div>

          <Documents candidatureId={c.id} titre="Dossier du candidat" />
        </>
      )}
    </div>
  );
}
