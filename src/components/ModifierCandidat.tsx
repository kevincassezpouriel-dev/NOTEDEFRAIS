"use client";

import { useState } from "react";
import { GARANTS, INVITES, RYTHMES, STATUTS_PRO } from "@/lib/crm";

export interface ProfilCandidat {
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
}

const iso = (d: string | null) => (d ? d.slice(0, 10) : "");

/**
 * Correction d'un candidat déjà enregistré : un numéro mal noté au téléphone,
 * un budget qui a bougé, une école mal orthographiée. Le score suggéré est
 * recalculé côté serveur sur les valeurs corrigées.
 */
export default function ModifierCandidat({
  candidature,
  onEnregistrer,
}: {
  candidature: ProfilCandidat;
  onEnregistrer: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState(() => depuis(candidature));

  function depuis(c: ProfilCandidat) {
    return {
      nom: c.nom,
      email: c.email,
      telephone: c.telephone ?? "",
      statutPro: c.statutPro,
      ecoleEmployeur: c.ecoleEmployeur ?? "",
      budgetMax: c.budgetMax != null ? String(c.budgetMax) : "",
      dateDispo: iso(c.dateDispo),
      dureeSouhaitee: c.dureeSouhaitee ?? "",
      garant: c.garant,
      rythme: c.rythme,
      menage: c.menage,
      invites: c.invites,
      fetes: c.fetes,
      fumeur: c.fumeur,
      animaux: c.animaux,
      motivation: c.motivation,
    };
  }

  function ouvrir() {
    setF(depuis(candidature));
    setOuvert(true);
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await onEnregistrer({ ...f, budgetMax: f.budgetMax === "" ? null : Number(f.budgetMax) });
    setBusy(false);
    setOuvert(false);
  }

  if (!ouvert) {
    return (
      <button className="btn btn-secondary !py-1 text-xs" onClick={ouvrir}>
        ✏️ Corriger le profil
      </button>
    );
  }

  return (
    <form onSubmit={enregistrer} className="space-y-3 p-3 rounded-lg" style={{ background: "var(--page)" }}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Corriger le profil</h3>
        <button type="button" className="text-xs underline" style={{ color: "var(--text-muted)" }}
          onClick={() => setOuvert(false)}>
          Annuler
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-medium mb-1">Nom *</label>
          <input className="input" required value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} />
        </div>
        <div className="flex-1 min-w-36">
          <label className="block text-xs font-medium mb-1">Téléphone</label>
          <input className="input" type="tel" value={f.telephone}
            onChange={(e) => setF({ ...f, telephone: e.target.value })} />
        </div>
        <div className="flex-1 min-w-44">
          <label className="block text-xs font-medium mb-1">E-mail *</label>
          <input className="input" type="email" required value={f.email}
            onChange={(e) => setF({ ...f, email: e.target.value })} />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-36">
          <label className="block text-xs font-medium mb-1">Situation</label>
          <select className="input" value={f.statutPro} onChange={(e) => setF({ ...f, statutPro: e.target.value })}>
            {STATUTS_PRO.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-44">
          <label className="block text-xs font-medium mb-1">École / employeur</label>
          <input className="input" value={f.ecoleEmployeur}
            onChange={(e) => setF({ ...f, ecoleEmployeur: e.target.value })} />
        </div>
        <div className="flex-1 min-w-28">
          <label className="block text-xs font-medium mb-1">Budget max (€)</label>
          <input className="input" type="number" min={0} value={f.budgetMax}
            onChange={(e) => setF({ ...f, budgetMax: e.target.value })} />
        </div>
        <div className="flex-1 min-w-36">
          <label className="block text-xs font-medium mb-1">Dispo à partir du</label>
          <input className="input" type="date" value={f.dateDispo}
            onChange={(e) => setF({ ...f, dateDispo: e.target.value })} />
        </div>
        <div className="flex-1 min-w-32">
          <label className="block text-xs font-medium mb-1">Durée souhaitée</label>
          <input className="input" placeholder="1 an" value={f.dureeSouhaitee}
            onChange={(e) => setF({ ...f, dureeSouhaitee: e.target.value })} />
        </div>
        <div className="flex-1 min-w-32">
          <label className="block text-xs font-medium mb-1">Garant</label>
          <select className="input" value={f.garant} onChange={(e) => setF({ ...f, garant: e.target.value })}>
            {GARANTS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-36">
          <label className="block text-xs font-medium mb-1">Rythme</label>
          <select className="input" value={f.rythme} onChange={(e) => setF({ ...f, rythme: e.target.value })}>
            {RYTHMES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-36">
          <label className="block text-xs font-medium mb-1">Invités</label>
          <select className="input" value={f.invites} onChange={(e) => setF({ ...f, invites: e.target.value })}>
            {INVITES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-medium mb-1">Ménage : {f.menage}/5</label>
          <input type="range" min={1} max={5} value={f.menage} className="w-full"
            onChange={(e) => setF({ ...f, menage: Number(e.target.value) })} />
        </div>
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-medium mb-1">Fêtes : {f.fetes}/5</label>
          <input type="range" min={1} max={5} value={f.fetes} className="w-full"
            onChange={(e) => setF({ ...f, fetes: Number(e.target.value) })} />
        </div>
        <div className="flex gap-4 text-sm pb-1">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={f.fumeur}
              onChange={(e) => setF({ ...f, fumeur: e.target.checked })} /> Fumeur
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={f.animaux}
              onChange={(e) => setF({ ...f, animaux: e.target.checked })} /> Animal
          </label>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1">Motivation / ce qu&apos;il a dit</label>
        <textarea className="input" rows={3} value={f.motivation}
          onChange={(e) => setF({ ...f, motivation: e.target.value })} />
      </div>

      <button className="btn btn-primary !py-1 text-xs" disabled={busy}>
        {busy ? "Enregistrement…" : "Enregistrer les corrections"}
      </button>
    </form>
  );
}
