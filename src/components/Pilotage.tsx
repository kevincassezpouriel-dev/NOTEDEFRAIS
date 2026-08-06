"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CATEGORIES, PROPRIETAIRE_SOURCES, PROPRIETAIRE_STATUTS, colorOf, labelOf } from "@/lib/crm";

interface Pilotage {
  chambresEnLigne: number;
  aQualifier: number;
  qualifiesNonTransmis: number;
  sansRetour: number;
  relancesEnRetard: number;
  installes: number;
  tunnel: {
    candidaturesTotal: number;
    transmisesTotal: number;
    visites: number;
    installes: number;
    tauxTransmission: number | null;
    tauxVisite: number | null;
    tauxInstallation: number | null;
    tauxReponseProprio: number | null;
  };
  demarchage: {
    proprietairesTotal: number;
    accordsObtenus: number;
    tauxAccord: number | null;
    spontanes: number;
    partSpontanee: number;
    parStatut: { statut: string; n: number }[];
    parSource: { source: string; n: number }[];
  };
  rythme: {
    candidaturesSemaine: number;
    candidaturesSemainePrec: number;
    evolution: number | null;
    installesMois: number;
    candidaturesParAnnonce: number | null;
    scoreMoyen: number | null;
    delaiQualificationH: number | null;
    delaiInstallationJ: number | null;
  };
  contactsParCategorie: { categorie: string; n: number }[];
  annoncesMuettes: { id: string; titre: string }[];
  taches: { id: string; titre: string; dueAt: string | null; contact: { id: string; nom: string } | null }[];
  activite: { id: string; title: string; detail: string | null; createdAt: string }[];
  acquisition: {
    id: string; name: string; slug: string; scans: number;
    candidatures: number; installes: number; tauxConversion: number | null;
  }[];
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

/** Un ratio du tunnel : la valeur, ce qu'elle mesure, et sa base de calcul. */
function Taux({ valeur, label, base }: { valeur: number | null; label: string; base: string }) {
  return (
    <div>
      <p className="font-display font-bold tabular-nums" style={{ fontSize: "1.6rem", lineHeight: 1.1 }}>
        {valeur == null ? "—" : `${valeur} %`}
      </p>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</p>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{base}</p>
    </div>
  );
}

/** Une barre de répartition proportionnelle, lisible d'un coup d'œil. */
function Repartition({
  items,
  couleur,
}: {
  items: { label: string; n: number; color?: string }[];
  couleur?: string;
}) {
  const total = items.reduce((s, i) => s + i.n, 0);
  if (total === 0) return <p className="text-xs" style={{ color: "var(--text-muted)" }}>Aucune donnée.</p>;
  return (
    <div className="space-y-1.5">
      {items.map((i, k) => (
        <div key={k} className="flex items-center gap-2 text-xs">
          <span className="w-32 shrink-0 truncate">{i.label}</span>
          <span className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--grid)" }}>
            <span
              className="block h-full rounded-full"
              style={{ width: `${(i.n / total) * 100}%`, background: i.color ?? couleur ?? "var(--accent)" }}
            />
          </span>
          <span className="tabular-nums w-8 text-right">{i.n}</span>
        </div>
      ))}
    </div>
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
          valeur={d.demarchage.partSpontanee}
          suffixe="%"
          label={`Propriétaires entrants spontanés (${d.demarchage.spontanes}/${d.demarchage.proprietairesTotal}) — le signal de bascule`}
          href="/admin/contacts?categorie=proprietaire"
        />
      </div>

      {/* Le tunnel : où ça passe, où ça bloque */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold mb-1">Tunnel de conversion</h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          {d.tunnel.candidaturesTotal} candidature(s) reçue(s) · {d.tunnel.transmisesTotal} transmise(s) ·{" "}
          {d.tunnel.visites} visite(s) · {d.tunnel.installes} emménagement(s)
        </p>
        <div className="grid gap-4 sm:grid-cols-4">
          <Taux valeur={d.tunnel.tauxTransmission} label="Candidatures transmises"
            base={`${d.tunnel.transmisesTotal} / ${d.tunnel.candidaturesTotal}`} />
          <Taux valeur={d.tunnel.tauxReponseProprio} label="Propriétaires qui répondent"
            base={`sur ${d.tunnel.transmisesTotal} transmission(s)`} />
          <Taux valeur={d.tunnel.tauxVisite} label="Transmissions → visite"
            base={`${d.tunnel.visites} visite(s)`} />
          <Taux valeur={d.tunnel.tauxInstallation} label="Candidature → emménagement"
            base={`${d.tunnel.installes} installé(s)`} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Rythme & qualité */}
        <div className="card p-4 space-y-3">
          <h2 className="text-sm font-semibold">Rythme &amp; qualité</h2>
          <div className="flex items-baseline gap-2">
            <span className="font-display font-bold tabular-nums" style={{ fontSize: "1.8rem" }}>
              {d.rythme.candidaturesSemaine}
            </span>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>candidatures cette semaine</span>
            {d.rythme.evolution != null && (
              <span className="text-xs font-medium"
                style={{ color: d.rythme.evolution >= 0 ? "var(--good)" : "var(--critical)" }}>
                {d.rythme.evolution >= 0 ? "▲" : "▼"} {Math.abs(d.rythme.evolution)} %
              </span>
            )}
          </div>
          <dl className="space-y-1.5 text-sm">
            {[
              ["Emménagements ce mois", d.rythme.installesMois],
              ["Candidatures par annonce en ligne", d.rythme.candidaturesParAnnonce],
              ["Score moyen attribué", d.rythme.scoreMoyen != null ? `${d.rythme.scoreMoyen}/5` : null],
              ["Délai moyen de qualification", d.rythme.delaiQualificationH != null ? `${d.rythme.delaiQualificationH} h` : null],
              ["Délai candidature → emménagement", d.rythme.delaiInstallationJ != null ? `${d.rythme.delaiInstallationJ} j` : null],
            ].map(([label, valeur], k) => (
              <div key={k} className="flex justify-between gap-3">
                <dt style={{ color: "var(--text-secondary)" }}>{label}</dt>
                <dd className="tabular-nums font-medium">{valeur ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Démarchage */}
        <div className="card p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Démarchage propriétaires</h2>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {d.demarchage.tauxAccord != null ? `${d.demarchage.tauxAccord} % d'accords` : "—"}
            </span>
          </div>
          <Repartition
            items={d.demarchage.parStatut.map((x) => ({
              label: labelOf(PROPRIETAIRE_STATUTS, x.statut),
              n: x.n,
              color: colorOf(PROPRIETAIRE_STATUTS, x.statut),
            }))}
          />
          <p className="text-xs pt-1" style={{ color: "var(--text-muted)" }}>D'où ils viennent</p>
          <Repartition
            items={d.demarchage.parSource.slice(0, 5).map((x) => ({
              label: labelOf(PROPRIETAIRE_SOURCES, x.source),
              n: x.n,
            }))}
          />
        </div>

        {/* Répertoire */}
        <div className="card p-4 space-y-3">
          <h2 className="text-sm font-semibold">Répertoire</h2>
          <Repartition
            items={d.contactsParCategorie.map((x) => ({
              label: labelOf(CATEGORIES, x.categorie),
              n: x.n,
            }))}
            couleur="var(--coral)"
          />
          <Link href="/admin/contacts" className="btn btn-secondary !py-1 text-xs w-full">
            Ouvrir le répertoire
          </Link>
        </div>
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
                  <th className="pb-2 font-medium text-right">Conv.</th>
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
                    <td className="py-2 text-right tabular-nums text-xs" style={{ color: "var(--text-muted)" }}>
                      {q.tauxConversion != null ? `${q.tauxConversion} %` : "—"}
                    </td>
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
