"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CANAUX, RESULTATS, colorOf, joursDepuis, labelOf } from "@/lib/crm";

interface Transmission {
  id: string;
  canal: string;
  resultat: string;
  commentaire: string | null;
  createdAt: string;
  dateResultat: string | null;
  candidature: { id: string; nom: string; scoreAffinite: number | null; telephone: string | null; email: string | null };
  annonce: { id: string; titre: string; proprietaire: { id: string; nom: string; telephone: string | null } };
}

/** Suivi des envois : c'est ici qu'on voit ce qui traîne. */
export default function TransmissionsPage() {
  const [items, setItems] = useState<Transmission[]>([]);
  const [resultat, setResultat] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/transmissions${resultat ? `?resultat=${resultat}` : ""}`, {
      cache: "no-store",
    });
    if (res.ok) setItems(await res.json());
  }, [resultat]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(id: string, data: Record<string, unknown>) {
    const res = await fetch(`/api/admin/transmissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setMsg("✓ Mis à jour");
      load();
    }
  }

  const enRetard = (t: Transmission) => {
    const j = joursDepuis(t.createdAt);
    return t.resultat === "en_attente" && j != null && j > 4;
  };
  const retards = items.filter(enRetard).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="mr-auto">
          <h1 className="text-xl font-semibold">Transmissions</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Chaque profil envoyé à un propriétaire, jusqu&apos;à l&apos;emménagement.
          </p>
        </div>
        {retards > 0 && (
          <span className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{ background: "var(--critical)", color: "#fff" }}>
            {retards} sans retour depuis plus de 4 jours
          </span>
        )}
        <select className="input !w-auto" value={resultat} onChange={(e) => setResultat(e.target.value)}>
          <option value="">Tous résultats</option>
          {RESULTATS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {msg && <p className="text-sm" style={{ color: "var(--good)" }}>{msg}</p>}

      <div className="card p-4 overflow-x-auto">
        {items.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Aucune transmission.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs border-b" style={{ color: "var(--text-muted)", borderColor: "var(--grid)" }}>
                <th className="py-2 pr-3 font-medium">Candidat</th>
                <th className="py-2 pr-3 font-medium">Annonce / propriétaire</th>
                <th className="py-2 pr-3 font-medium">Envoyé</th>
                <th className="py-2 pr-3 font-medium">Canal</th>
                <th className="py-2 pr-3 font-medium">Résultat</th>
                <th className="py-2 font-medium">Commentaire</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-b" style={{ borderColor: "var(--grid)" }}>
                  <td className="py-2.5 pr-3">
                    <span className="font-medium">{t.candidature.nom}</span>
                    {t.candidature.scoreAffinite && (
                      <span className="block text-xs" style={{ color: "var(--accent)" }}>
                        {"★".repeat(t.candidature.scoreAffinite)}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-xs">
                    <Link href={`/admin/annonces/${t.annonce.id}`} className="hover:underline">{t.annonce.titre}</Link>
                    <Link href={`/admin/contacts/${t.annonce.proprietaire.id}`}
                      className="block hover:underline" style={{ color: "var(--text-muted)" }}>
                      {t.annonce.proprietaire.nom}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-3 text-xs"
                    style={{ color: enRetard(t) ? "var(--critical)" : "var(--text-muted)" }}>
                    il y a {joursDepuis(t.createdAt)} j
                    {enRetard(t) && <span className="block font-medium">à relancer</span>}
                  </td>
                  <td className="py-2.5 pr-3">
                    <select className="input !w-auto !py-1 text-xs" value={t.canal}
                      onChange={(e) => patch(t.id, { canal: e.target.value })}>
                      {CANAUX.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                    </select>
                  </td>
                  <td className="py-2.5 pr-3">
                    <select className="input !w-auto !py-1 text-xs" value={t.resultat}
                      style={{ color: colorOf(RESULTATS, t.resultat) }}
                      onChange={(e) => patch(t.id, { resultat: e.target.value })}>
                      {RESULTATS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </td>
                  <td className="py-2.5">
                    <input className="input !py-1 text-xs" defaultValue={t.commentaire ?? ""}
                      placeholder="…" onBlur={(e) => patch(t.id, { commentaire: e.target.value })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        « Accepté / installé » bascule automatiquement le candidat en installé et l&apos;annonce en pourvue.
        Un refus écarte le candidat.
      </p>
    </div>
  );
}
