"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { ANNONCE_STATUTS, CANDIDATURE_STATUTS, labelOf } from "@/lib/crm";

interface Annonce {
  id: string;
  titre: string;
  slug: string;
  statut: string;
  referenceExterne: string | null;
  quartier: string | null;
  adresseApprox: string | null;
  loyer: number | null;
  charges: number | null;
  caution: number | null;
  surfaceChambre: number | null;
  surfaceTotale: number | null;
  meublee: boolean;
  dateDispo: string | null;
  dureeMin: string | null;
  nbColocataires: number | null;
  profilColocataires: string | null;
  description: string | null;
  equipements: string | null;
  photos: string | null;
  proprietaire: { id: string; nom: string; briefRecherche: string | null };
  qrCode: { id: string; slug: string } | null;
  candidatures: { id: string; nom: string; statut: string; scoreAffinite: number | null; scoreSuggere: number | null }[];
}

const iso = (d: string | null) => (d ? d.slice(0, 10) : "");

export default function FicheAnnonce({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [a, setA] = useState<Annonce | null>(null);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/annonces/${id}`, { cache: "no-store" });
    if (res.ok) setA(await res.json());
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(data: Record<string, unknown>, texte = "✓ Enregistré") {
    const res = await fetch(`/api/admin/annonces/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setMsg(res.ok ? { text: texte, error: false } : { text: "Erreur", error: true });
    if (res.ok) load();
  }

  async function supprimer() {
    if (!a || !window.confirm(`Supprimer « ${a.titre} » et ses candidatures ?`)) return;
    const res = await fetch(`/api/admin/annonces/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/annonces");
  }

  if (!a) return <p className="text-sm" style={{ color: "var(--text-muted)" }}>Chargement…</p>;

  const champ = (
    label: string,
    key: keyof Annonce,
    type: "text" | "number" | "date" = "text"
  ) => (
    <div className="flex-1 min-w-32">
      <label className="block text-xs font-medium mb-1">{label}</label>
      <input
        type={type}
        className="input"
        defaultValue={type === "date" ? iso(a[key] as string | null) : ((a[key] as string | number | null) ?? "")}
        onBlur={(e) => patch({ [key]: e.target.value || null })}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/annonces" className="text-sm" style={{ color: "var(--text-muted)" }}>← Annonces</Link>
        <h1 className="text-xl font-semibold truncate">{a.titre}</h1>
        <Link href={`/admin/contacts/${a.proprietaire.id}`} className="text-xs underline"
          style={{ color: "var(--text-muted)" }}>
          {a.proprietaire.nom}
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <select className="input !w-auto" value={a.statut} onChange={(e) => patch({ statut: e.target.value })}>
            {ANNONCE_STATUTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {a.statut === "en_ligne" && (
            <a href={`/colocations/${a.slug}`} target="_blank" className="btn btn-secondary">Voir en ligne ↗</a>
          )}
          <button className="btn btn-danger" onClick={supprimer}>Supprimer</button>
        </div>
      </div>

      {msg && <p className="text-sm" style={{ color: msg.error ? "var(--critical)" : "var(--good)" }}>{msg.text}</p>}

      {a.proprietaire.briefRecherche && (
        <div className="card p-4" style={{ borderLeft: "3px solid var(--accent)" }}>
          <h2 className="text-sm font-semibold mb-1">🎯 Brief du propriétaire</h2>
          <p className="text-sm whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>
            {a.proprietaire.briefRecherche}
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-4 space-y-3">
            <h2 className="text-sm font-semibold">Le logement</h2>
            <div className="flex flex-wrap gap-3">
              {champ("Titre", "titre")}
              {champ("Quartier", "quartier")}
            </div>
            <div className="flex flex-wrap gap-3">
              {champ("Loyer (€)", "loyer", "number")}
              {champ("Charges (€)", "charges", "number")}
              {champ("Caution (€)", "caution", "number")}
              {champ("Chambre (m²)", "surfaceChambre", "number")}
              {champ("Logement (m²)", "surfaceTotale", "number")}
            </div>
            <div className="flex flex-wrap gap-3 items-end">
              {champ("Disponible le", "dateDispo", "date")}
              {champ("Durée min.", "dureeMin")}
              {champ("Nb colocs", "nbColocataires", "number")}
              <label className="flex items-center gap-2 text-sm pb-2">
                <input type="checkbox" defaultChecked={a.meublee}
                  onChange={(e) => patch({ meublee: e.target.checked })} />
                Meublée
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              {champ("Adresse approximative (publique)", "adresseApprox")}
              {champ("Référence logement (app Minggle)", "referenceExterne")}
            </div>
            {(["description", "profilColocataires", "equipements", "photos"] as const).map((k) => (
              <div key={k}>
                <label className="block text-xs font-medium mb-1">
                  {k === "description" && "Description"}
                  {k === "profilColocataires" && "Qui vit déjà là"}
                  {k === "equipements" && "Équipements"}
                  {k === "photos" && "Photos (une URL par ligne)"}
                </label>
                <textarea className="input" rows={k === "photos" ? 3 : 3} defaultValue={a[k] ?? ""}
                  onBlur={(e) => patch({ [k]: e.target.value })} />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-2">Acquisition</h2>
            {a.qrCode ? (
              <>
                <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
                  QR/lien dédié à cette annonce — imprime-le sur les flyers pour mesurer ce qui convertit.
                </p>
                <Link href={`/admin/qrcodes/${a.qrCode.id}`} className="btn btn-secondary !py-1 text-xs w-full">
                  Ouvrir le QR code
                </Link>
                <p className="text-xs mt-2 font-mono break-all" style={{ color: "var(--text-muted)" }}>
                  /r/{a.qrCode.slug}
                </p>
              </>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Aucun QR associé.</p>
            )}
          </div>

          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-2">
              Candidatures ({a.candidatures.length})
            </h2>
            {a.candidatures.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Aucune candidature.</p>
            ) : (
              <div className="space-y-1.5">
                {a.candidatures.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">{c.nom}</span>
                    <span className="text-xs" style={{ color: "var(--accent)" }}>
                      {c.scoreAffinite ? "★".repeat(c.scoreAffinite) : `~${c.scoreSuggere ?? "?"}`}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--grid)" }}>
                      {labelOf(CANDIDATURE_STATUTS, c.statut)}
                    </span>
                  </div>
                ))}
                <Link href={`/admin/candidatures?annonceId=${a.id}`}
                  className="btn btn-secondary !py-1 text-xs w-full mt-2">
                  Qualifier les candidats
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
