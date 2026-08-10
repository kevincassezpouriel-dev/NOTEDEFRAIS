"use client";

import { useEffect, useState } from "react";
import { GARANTS, INVITES, RYTHMES, STATUTS_PRO } from "@/lib/crm";

interface AnnonceOption {
  id: string;
  titre: string;
  statut: string;
}

const VIDE = {
  annonceId: "",
  nom: "",
  telephone: "",
  email: "",
  statutPro: "etudiant",
  ecoleEmployeur: "",
  budgetMax: "",
  dateDispo: "",
  dureeSouhaitee: "",
  garant: "a_verifier",
  rythme: "flexible",
  menage: 3,
  invites: "parfois",
  fetes: 3,
  fumeur: false,
  animaux: false,
  motivation: "",
  notesQualification: "",
};

/**
 * Saisie manuelle d'un candidat : celui qu'on a eu au téléphone, croisé sur
 * le terrain ou reçu par message. Le score suggéré est calculé pareil que
 * pour une candidature en ligne.
 */
export default function AjouterCandidat({
  annonceIdParDefaut,
  onAjoute,
}: {
  annonceIdParDefaut?: string;
  onAjoute: () => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [annonces, setAnnonces] = useState<AnnonceOption[]>([]);
  const [form, setForm] = useState({ ...VIDE, annonceId: annonceIdParDefaut ?? "" });
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!ouvert) return;
    fetch("/api/admin/annonces", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: AnnonceOption[]) =>
        setAnnonces(data.filter((a) => a.statut === "en_ligne" || a.statut === "brouillon"))
      );
  }, [ouvert]);

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErreur(null);
    const res = await fetch("/api/admin/candidatures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (res.ok) {
      setForm({ ...VIDE, annonceId: annonceIdParDefaut ?? "" });
      setOuvert(false);
      onAjoute();
    } else {
      const d = await res.json().catch(() => null);
      setErreur(d?.error ?? "Erreur");
    }
  }

  if (!ouvert) {
    return (
      <button className="btn btn-secondary" onClick={() => setOuvert(true)}>
        + Ajouter un candidat
      </button>
    );
  }

  return (
    <form onSubmit={enregistrer} className="card p-4 space-y-3 w-full">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Ajouter un candidat</h2>
        <button type="button" className="text-xs underline" style={{ color: "var(--text-muted)" }}
          onClick={() => setOuvert(false)}>
          Fermer
        </button>
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Pour un candidat rencontré au téléphone, sur le terrain ou arrivé par message.
        Renseigne ce que tu sais — le score se recalcule à la qualification.
      </p>

      <div className="flex flex-wrap gap-3">
        <div className="flex-[2] min-w-56">
          <label className="block text-xs font-medium mb-1">Annonce visée *</label>
          <select className="input" required value={form.annonceId}
            onChange={(e) => setForm({ ...form, annonceId: e.target.value })}>
            <option value="">— choisir —</option>
            {annonces.map((a) => (
              <option key={a.id} value={a.id}>{a.titre}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-medium mb-1">Nom *</label>
          <input className="input" required value={form.nom}
            onChange={(e) => setForm({ ...form, nom: e.target.value })} />
        </div>
        <div className="flex-1 min-w-36">
          <label className="block text-xs font-medium mb-1">Téléphone</label>
          <input className="input" value={form.telephone}
            onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
        </div>
        <div className="flex-1 min-w-44">
          <label className="block text-xs font-medium mb-1">E-mail</label>
          <input className="input" type="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-36">
          <label className="block text-xs font-medium mb-1">Situation</label>
          <select className="input" value={form.statutPro}
            onChange={(e) => setForm({ ...form, statutPro: e.target.value })}>
            {STATUTS_PRO.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-44">
          <label className="block text-xs font-medium mb-1">École / employeur</label>
          <input className="input" value={form.ecoleEmployeur}
            onChange={(e) => setForm({ ...form, ecoleEmployeur: e.target.value })} />
        </div>
        <div className="flex-1 min-w-28">
          <label className="block text-xs font-medium mb-1">Budget max (€)</label>
          <input className="input" type="number" min={0} value={form.budgetMax}
            onChange={(e) => setForm({ ...form, budgetMax: e.target.value })} />
        </div>
        <div className="flex-1 min-w-36">
          <label className="block text-xs font-medium mb-1">Dispo à partir du</label>
          <input className="input" type="date" value={form.dateDispo}
            onChange={(e) => setForm({ ...form, dateDispo: e.target.value })} />
        </div>
        <div className="flex-1 min-w-32">
          <label className="block text-xs font-medium mb-1">Garant</label>
          <select className="input" value={form.garant}
            onChange={(e) => setForm({ ...form, garant: e.target.value })}>
            {GARANTS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-36">
          <label className="block text-xs font-medium mb-1">Rythme</label>
          <select className="input" value={form.rythme}
            onChange={(e) => setForm({ ...form, rythme: e.target.value })}>
            {RYTHMES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-36">
          <label className="block text-xs font-medium mb-1">Invités</label>
          <select className="input" value={form.invites}
            onChange={(e) => setForm({ ...form, invites: e.target.value })}>
            {INVITES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-medium mb-1">Ménage : {form.menage}/5</label>
          <input type="range" min={1} max={5} value={form.menage} className="w-full"
            onChange={(e) => setForm({ ...form, menage: Number(e.target.value) })} />
        </div>
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-medium mb-1">Fêtes : {form.fetes}/5</label>
          <input type="range" min={1} max={5} value={form.fetes} className="w-full"
            onChange={(e) => setForm({ ...form, fetes: Number(e.target.value) })} />
        </div>
        <div className="flex gap-4 text-sm pb-1">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={form.fumeur}
              onChange={(e) => setForm({ ...form, fumeur: e.target.checked })} /> Fumeur
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={form.animaux}
              onChange={(e) => setForm({ ...form, animaux: e.target.checked })} /> Animal
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-56">
          <label className="block text-xs font-medium mb-1">
            Ce qu&apos;il cherche / ce qu&apos;il a dit
          </label>
          <textarea className="input" rows={2} value={form.motivation}
            onChange={(e) => setForm({ ...form, motivation: e.target.value })} />
        </div>
        <div className="flex-1 min-w-56">
          <label className="block text-xs font-medium mb-1">Notes internes</label>
          <textarea className="input" rows={2} value={form.notesQualification}
            onChange={(e) => setForm({ ...form, notesQualification: e.target.value })} />
        </div>
      </div>

      {erreur && <p className="text-sm" style={{ color: "var(--critical)" }}>{erreur}</p>}
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Enregistrement…" : "Ajouter le candidat"}
      </button>
    </form>
  );
}
