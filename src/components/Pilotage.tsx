"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Pilotage {
  chambresEnLigne: number;
  aQualifier: number;
  qualifiesNonTransmis: number;
  sansRetour: number;
  relancesEnRetard: number;
  installes: number;
  proprietairesTotal: number;
  proprietairesSpontanes: number;
  partSpontanee: number;
  annoncesMuettes: { id: string; titre: string }[];
  taches: { id: string; titre: string; dueAt: string | null; contact: { id: string; nom: string } | null }[];
  activite: { id: string; title: string; detail: string | null; createdAt: string }[];
  acquisition: { id: string; name: string; slug: string; scans: number; candidatures: number; installes: number }[];
}

/** Une tuile = un chiffre qui appelle une action. Cliquable, jamais décorative. */
function Tuile({
  valeur,
  label,
  href,
  alerte,
  grand,
  suffixe,
}: {
  valeur: number;
  label: string;
  href: string;
  alerte?: boolean;
  grand?: boolean;
  suffixe?: string;
}) {
  const actif = valeur > 0;
  return (
    <Link
      href={href}
      className="card p-4 block"
      style={{
        borderLeft: `3px solid ${alerte && actif ? "var(--critical)" : actif ? "var(--accent)" : "var(--border)"}`,
      }}
    >
      <p
        className="font-display font-bold tabular-nums"
        style={{
          fontSize: grand ? "2.6rem" : "1.9rem",
          lineHeight: 1.05,
          color: alerte && actif ? "var(--critical)" : "var(--text-primary)",
        }}
      >
        {valeur}
        {suffixe && <span className="text-lg font-medium"> {suffixe}</span>}
      </p>
      <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
        {label}
      </p>
    </Link>
  );
}

export default function Pilotage() {
  const [d, setD] = useState<Pilotage | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/pilotage", { cache: "no-store" });
    if (res.ok) setD(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function cocher(id: string) {
    await fetch(`/api/admin/taches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: true }),
    });
    load();
  }

  if (!d) return <p className="text-sm" style={{ color: "var(--text-muted)" }}>Chargement…</p>;

  const alertes = d.sansRetour + d.relancesEnRetard + d.annoncesMuettes.length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Pilotage</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          {alertes > 0
            ? `${alertes} point${alertes > 1 ? "s" : ""} demandent ton attention aujourd'hui.`
            : "Tout est à jour. Va démarcher. 🚀"}
        </p>
      </div>

      {/* L'indicateur roi + le pipeline */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tuile grand valeur={d.chambresEnLigne} label="Chambres en ligne" href="/admin/annonces?statut=en_ligne" />
        <Tuile valeur={d.aQualifier} label="Candidatures à qualifier" href="/admin/candidatures" />
        <Tuile valeur={d.qualifiesNonTransmis} label="Qualifiés, pas encore transmis" href="/admin/candidatures" />
        <Tuile valeur={d.installes} label="Emménagements confirmés" href="/admin/transmissions" />
      </div>

      {/* Ce qui coince */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tuile alerte valeur={d.sansRetour} label="Transmissions sans retour depuis +4 jours" href="/admin/transmissions" />
        <Tuile alerte valeur={d.relancesEnRetard} label="Relances propriétaires en retard" href="/admin/contacts" />
        <Tuile alerte valeur={d.annoncesMuettes.length} label="Annonces sans candidature depuis 10 jours" href="/admin/annonces?statut=en_ligne" />
        <Tuile
          valeur={d.partSpontanee}
          suffixe="%"
          label={`Propriétaires entrants spontanés (${d.proprietairesSpontanes}/${d.proprietairesTotal}) — le signal de bascule`}
          href="/admin/contacts?categorie=proprietaire"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Acquisition : quel flyer, quel lieu convertit */}
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-1">Performance par point d&apos;acquisition</h2>
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
            Quel flyer, quel lieu, quel QR amène vraiment des candidats.
          </p>
          {d.acquisition.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Aucun scan pour l&apos;instant. Crée un QR par flyer dans « QR &amp; liens ».
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs" style={{ color: "var(--text-muted)" }}>
                  <th className="pb-2 font-medium">Support</th>
                  <th className="pb-2 font-medium text-right">Scans</th>
                  <th className="pb-2 font-medium text-right">Candidatures</th>
                  <th className="pb-2 font-medium text-right">Installés</th>
                </tr>
              </thead>
              <tbody>
                {d.acquisition.slice(0, 8).map((q) => (
                  <tr key={q.id} className="border-t" style={{ borderColor: "var(--grid)" }}>
                    <td className="py-2 pr-2">
                      <Link href={`/admin/qrcodes/${q.id}`} className="hover:underline">{q.name}</Link>
                    </td>
                    <td className="py-2 text-right tabular-nums">{q.scans}</td>
                    <td className="py-2 text-right tabular-nums font-medium">{q.candidatures}</td>
                    <td className="py-2 text-right tabular-nums" style={{ color: "var(--good)" }}>{q.installes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* À faire aujourd'hui */}
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3">À faire</h2>
          {d.taches.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Aucune tâche ouverte.</p>
          ) : (
            <ul className="space-y-2">
              {d.taches.map((t) => {
                const retard = t.dueAt != null && new Date(t.dueAt) < new Date();
                return (
                  <li key={t.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" onChange={() => cocher(t.id)} />
                    <span className="flex-1">
                      {t.titre}
                      {t.contact && (
                        <Link href={`/admin/contacts/${t.contact.id}`} className="text-xs ml-1.5 underline"
                          style={{ color: "var(--text-muted)" }}>
                          {t.contact.nom}
                        </Link>
                      )}
                    </span>
                    {t.dueAt && (
                      <span className="text-xs" style={{ color: retard ? "var(--critical)" : "var(--text-muted)" }}>
                        {new Date(t.dueAt).toLocaleDateString("fr-FR")}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {d.annoncesMuettes.length > 0 && (
            <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--grid)" }}>
              <p className="text-xs font-medium mb-1" style={{ color: "var(--critical)" }}>
                Annonces sans aucune candidature
              </p>
              {d.annoncesMuettes.map((a) => (
                <Link key={a.id} href={`/admin/annonces/${a.id}`} className="block text-xs hover:underline"
                  style={{ color: "var(--text-secondary)" }}>
                  · {a.titre}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fil d'activité */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold mb-3">Activité récente</h2>
        {d.activite.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Rien encore.</p>
        ) : (
          <ol className="space-y-1.5">
            {d.activite.map((a) => (
              <li key={a.id} className="text-sm flex gap-3">
                <span className="text-xs tabular-nums shrink-0" style={{ color: "var(--text-muted)" }}>
                  {new Date(a.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="min-w-0">
                  {a.title}
                  {a.detail && (
                    <span className="text-xs block truncate" style={{ color: "var(--text-muted)" }}>{a.detail}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
