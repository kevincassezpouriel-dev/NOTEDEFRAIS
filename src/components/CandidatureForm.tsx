"use client";

import { useEffect, useState } from "react";
import { GARANTS, INVITES, RYTHMES, STATUTS_PRO } from "@/lib/crm";

const MOTIVATION_MIN = 100;

/**
 * Formulaire public de candidature. Capture automatiquement la source
 * d'acquisition (?utm_source= / ?source= / QR scanné) pour savoir quel
 * flyer, quel lieu a amené le candidat.
 */
export default function CandidatureForm({ annonceSlug }: { annonceSlug: string }) {
  const [source, setSource] = useState("");
  const [motivation, setMotivation] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s = p.get("utm_source") || p.get("source") || p.get("c") || document.referrer || "";
    setSource(s.slice(0, 80));
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = { annonceSlug, source, motivation };
    fd.forEach((v, k) => {
      payload[k] = v === "on" ? true : v;
    });
    payload.fumeur = fd.get("fumeur") === "on";
    payload.animaux = fd.get("animaux") === "on";

    const res = await fetch("/api/candidatures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) setDone(true);
    else {
      const d = await res.json().catch(() => null);
      setError(d?.error ?? "Une erreur est survenue, réessaie.");
    }
  }

  if (done) {
    return (
      <div className="card p-6 text-center">
        <h2 className="text-lg font-semibold mb-2">Candidature envoyée 🎉</h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          On lit ton profil sous 48 h. Si ça matche avec la coloc, on te recontacte
          pour organiser la visite. Pas de spam, promis.
        </p>
      </div>
    );
  }

  const restant = MOTIVATION_MIN - motivation.trim().length;

  return (
    <form onSubmit={submit} className="card p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Postuler pour cette chambre</h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Ces quelques questions servent à vérifier que le courant passera avec la
          coloc — c&apos;est ce qui fait la différence.
        </p>
      </div>

      {/* Piège à robots : invisible pour un humain */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}
      />

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium mb-1" htmlFor="c-nom">Prénom et nom *</label>
          <input id="c-nom" name="nom" className="input" required />
        </div>
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium mb-1" htmlFor="c-email">E-mail *</label>
          <input id="c-email" name="email" type="email" className="input" required />
        </div>
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium mb-1" htmlFor="c-tel">Téléphone</label>
          <input id="c-tel" name="telephone" className="input" />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-medium mb-1" htmlFor="c-statut">Situation</label>
          <select id="c-statut" name="statutPro" className="input" defaultValue="etudiant">
            {STATUTS_PRO.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium mb-1" htmlFor="c-ecole">École ou employeur</label>
          <input id="c-ecole" name="ecoleEmployeur" className="input" />
        </div>
        <div className="flex-1 min-w-32">
          <label className="block text-xs font-medium mb-1" htmlFor="c-budget">Budget max (€)</label>
          <input id="c-budget" name="budgetMax" type="number" min={0} className="input" />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-medium mb-1" htmlFor="c-dispo">Disponible à partir du</label>
          <input id="c-dispo" name="dateDispo" type="date" className="input" />
        </div>
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-medium mb-1" htmlFor="c-duree">Durée souhaitée</label>
          <input id="c-duree" name="dureeSouhaitee" className="input" placeholder="ex. 1 an" />
        </div>
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-medium mb-1" htmlFor="c-garant">Garant</label>
          <select id="c-garant" name="garant" className="input" defaultValue="a_verifier">
            {GARANTS.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="border-t pt-4" style={{ borderColor: "var(--grid)" }}>
        <legend className="text-sm font-semibold px-1">Ton mode de vie</legend>
        <div className="flex flex-wrap gap-3 mt-2">
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium mb-1" htmlFor="c-rythme">Rythme</label>
            <select id="c-rythme" name="rythme" className="input" defaultValue="flexible">
              {RYTHMES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium mb-1" htmlFor="c-invites">Tu reçois des amis</label>
            <select id="c-invites" name="invites" className="input" defaultValue="parfois">
              {INVITES.map((i) => (
                <option key={i.value} value={i.value}>{i.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-6 mt-4">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium mb-1" htmlFor="c-menage">
              Ménage : 1 = tranquille, 5 = maniaque
            </label>
            <input id="c-menage" name="menage" type="range" min={1} max={5} defaultValue={3} className="w-full" />
          </div>
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium mb-1" htmlFor="c-fetes">
              Fêtes : 1 = jamais, 5 = souvent
            </label>
            <input id="c-fetes" name="fetes" type="range" min={1} max={5} defaultValue={3} className="w-full" />
          </div>
        </div>
        <div className="flex flex-wrap gap-6 mt-3 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="fumeur" /> Je fume
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="animaux" /> J&apos;ai un animal
          </label>
        </div>
      </fieldset>

      <div>
        <label className="block text-xs font-medium mb-1" htmlFor="c-motiv">
          Pourquoi cette coloc en particulier ? *
        </label>
        <textarea
          id="c-motiv"
          className="input"
          rows={5}
          value={motivation}
          onChange={(e) => setMotivation(e.target.value)}
          placeholder="Parle-nous de toi, de ton rythme, de ce que tu cherches dans une coloc…"
          required
        />
        <p className="text-xs mt-1" style={{ color: restant > 0 ? "var(--critical)" : "var(--good)" }}>
          {restant > 0 ? `Encore ${restant} caractères` : "✓ Parfait"}
        </p>
      </div>

      {error && <p className="text-sm" style={{ color: "var(--critical)" }}>{error}</p>}

      <button type="submit" className="btn btn-primary w-full !py-3" disabled={busy || restant > 0}>
        {busy ? "Envoi…" : "Envoyer ma candidature"}
      </button>
      <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
        Ta candidature est lue par l&apos;équipe Minggle, jamais transmise sans ton accord.
      </p>
    </form>
  );
}
