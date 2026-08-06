import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const JOURS_SANS_RETOUR = 4;
const JOURS_ANNONCE_MUETTE = 10;
const JOUR = 86_400_000;

/** Moyenne arrondie ; null si aucune donnée (on n'invente pas un zéro). */
function moyenne(valeurs: number[], decimales = 0): number | null {
  if (valeurs.length === 0) return null;
  const m = valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
  return Number(m.toFixed(decimales));
}

function pourcent(part: number, total: number): number | null {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

/**
 * Pilotage de l'opération : d'abord ce qui appelle une action aujourd'hui,
 * puis la performance du tunnel (taux, délais, tendance). Aucun chiffre
 * décoratif — chacun révèle soit une action à mener, soit un blocage.
 */
export async function GET() {
  const maintenant = new Date();
  const seuilRetour = new Date(maintenant.getTime() - JOURS_SANS_RETOUR * JOUR);
  const seuilMuette = new Date(maintenant.getTime() - JOURS_ANNONCE_MUETTE * JOUR);
  const semaine = new Date(maintenant.getTime() - 7 * JOUR);
  const semainePrec = new Date(maintenant.getTime() - 14 * JOUR);
  const mois = new Date(maintenant.getTime() - 30 * JOUR);

  const [
    chambresEnLigne,
    aQualifier,
    qualifiesNonTransmis,
    sansRetour,
    relancesEnRetard,
    installes,
    candidaturesTotal,
    candidaturesSemaine,
    candidaturesSemainePrec,
    installesMois,
    contactsParCategorie,
    proprietairesParStatut,
    proprietairesParSource,
    transmissions,
    qualifActions,
    candidaturesInstallees,
    scores,
    tachesDuJour,
    activite,
    annonces,
    qrCodes,
  ] = await Promise.all([
    prisma.annonce.count({ where: { statut: "en_ligne" } }),
    prisma.candidature.count({ where: { statut: "a_qualifier" } }),
    prisma.candidature.count({ where: { statut: "qualifie" } }),
    prisma.transmission.count({ where: { resultat: "en_attente", createdAt: { lt: seuilRetour } } }),
    prisma.contact.count({
      where: {
        categorie: "proprietaire",
        dateRelancePrevue: { lt: maintenant },
        statut: { notIn: ["accord_obtenu", "refus"] },
      },
    }),
    prisma.candidature.count({ where: { statut: "installe" } }),
    prisma.candidature.count(),
    prisma.candidature.count({ where: { createdAt: { gte: semaine } } }),
    prisma.candidature.count({ where: { createdAt: { gte: semainePrec, lt: semaine } } }),
    prisma.candidature.count({ where: { statut: "installe", createdAt: { gte: mois } } }),
    prisma.contact.groupBy({ by: ["categorie"], _count: { _all: true } }),
    prisma.contact.groupBy({
      by: ["statut"],
      where: { categorie: "proprietaire" },
      _count: { _all: true },
    }),
    prisma.contact.groupBy({
      by: ["source"],
      where: { categorie: "proprietaire" },
      _count: { _all: true },
    }),
    prisma.transmission.findMany({
      select: { candidatureId: true, resultat: true, createdAt: true, dateResultat: true },
    }),
    prisma.action.findMany({
      where: { type: "candidature.qualifiee" },
      select: { refId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.candidature.findMany({
      where: { statut: "installe" },
      select: { id: true, createdAt: true },
    }),
    prisma.candidature.findMany({
      where: { scoreAffinite: { not: null } },
      select: { scoreAffinite: true },
    }),
    prisma.tache.findMany({
      where: { done: false },
      orderBy: [{ dueAt: "asc" }],
      take: 12,
      include: { contact: { select: { id: true, nom: true } } },
    }),
    prisma.action.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.annonce.findMany({
      where: { statut: { in: ["en_ligne", "pourvue"] } },
      select: {
        id: true,
        titre: true,
        statut: true,
        publishedAt: true,
        qrCodeId: true,
        _count: { select: { candidatures: true } },
      },
    }),
    prisma.qrCode.findMany({
      select: { id: true, name: true, slug: true, _count: { select: { scans: true } } },
    }),
  ]);

  const enLigne = annonces.filter((a) => a.statut === "en_ligne");
  const annoncesMuettes = enLigne.filter(
    (a) => a._count.candidatures === 0 && a.publishedAt != null && a.publishedAt < seuilMuette
  );

  // --- Tunnel de transmission ---
  const transmisesTotal = transmissions.length;
  const avecReponse = transmissions.filter((t) => t.resultat !== "en_attente").length;
  const visites = transmissions.filter((t) =>
    ["visite_prevue", "visite_faite", "accepte_installe"].includes(t.resultat)
  ).length;

  // --- Délai moyen de qualification (réception → première qualification) ---
  const premiereQualif = new Map<string, Date>();
  for (const a of qualifActions) {
    if (a.refId && !premiereQualif.has(a.refId)) premiereQualif.set(a.refId, a.createdAt);
  }
  const idsQualifies = [...premiereQualif.keys()];
  const datesReception = idsQualifies.length
    ? await prisma.candidature.findMany({
        where: { id: { in: idsQualifies } },
        select: { id: true, createdAt: true },
      })
    : [];
  const delaisQualif = datesReception
    .map((c) => {
      const q = premiereQualif.get(c.id);
      return q ? (q.getTime() - c.createdAt.getTime()) / 3_600_000 : null;
    })
    .filter((h): h is number => h != null && h >= 0);

  // --- Délai moyen candidature → emménagement ---
  const installParCandidature = new Map<string, Date>();
  for (const t of transmissions) {
    if (t.resultat === "accepte_installe" && t.dateResultat) {
      installParCandidature.set(t.candidatureId, t.dateResultat);
    }
  }
  const delaisInstallation = candidaturesInstallees
    .map((c) => {
      const d = installParCandidature.get(c.id);
      return d ? (d.getTime() - c.createdAt.getTime()) / JOUR : null;
    })
    .filter((j): j is number => j != null && j >= 0);

  // --- Acquisition : scans → candidatures → installés, par support ---
  const parQr = await Promise.all(
    qrCodes.map(async (qr) => {
      const annonceIds = annonces.filter((a) => a.qrCodeId === qr.id).map((a) => a.id);
      const [candidatures, installesQr] = await Promise.all([
        annonceIds.length
          ? prisma.candidature.count({ where: { annonceId: { in: annonceIds } } })
          : prisma.candidature.count({ where: { campagneSource: { contains: qr.slug } } }),
        annonceIds.length
          ? prisma.candidature.count({
              where: { annonceId: { in: annonceIds }, statut: "installe" },
            })
          : 0,
      ]);
      return {
        id: qr.id,
        name: qr.name,
        slug: qr.slug,
        scans: qr._count.scans,
        candidatures,
        installes: installesQr,
        tauxConversion: pourcent(candidatures, qr._count.scans),
      };
    })
  );

  const proprietairesTotal = proprietairesParStatut.reduce((s, x) => s + x._count._all, 0);
  const accordsObtenus =
    proprietairesParStatut.find((x) => x.statut === "accord_obtenu")?._count._all ?? 0;
  const contactesOuPlus = proprietairesParStatut
    .filter((x) => x.statut !== "a_contacter")
    .reduce((s, x) => s + x._count._all, 0);
  const spontanes =
    proprietairesParSource.find((x) => x.source === "entrant_spontane")?._count._all ?? 0;

  return NextResponse.json({
    // Ce qui appelle une action aujourd'hui
    chambresEnLigne,
    aQualifier,
    qualifiesNonTransmis,
    sansRetour,
    relancesEnRetard,
    installes,
    annoncesMuettes: annoncesMuettes.map((a) => ({ id: a.id, titre: a.titre })),

    // Performance du tunnel
    tunnel: {
      candidaturesTotal,
      transmisesTotal,
      visites,
      installes,
      tauxTransmission: pourcent(transmisesTotal, candidaturesTotal),
      tauxVisite: pourcent(visites, transmisesTotal),
      tauxInstallation: pourcent(installes, candidaturesTotal),
      tauxReponseProprio: pourcent(avecReponse, transmisesTotal),
    },

    // Démarchage propriétaires
    demarchage: {
      proprietairesTotal,
      accordsObtenus,
      tauxAccord: pourcent(accordsObtenus, contactesOuPlus),
      spontanes,
      partSpontanee: pourcent(spontanes, proprietairesTotal) ?? 0,
      parStatut: proprietairesParStatut.map((x) => ({ statut: x.statut, n: x._count._all })),
      parSource: proprietairesParSource
        .map((x) => ({ source: x.source, n: x._count._all }))
        .sort((a, b) => b.n - a.n),
    },

    // Rythme & qualité
    rythme: {
      candidaturesSemaine,
      candidaturesSemainePrec,
      evolution:
        candidaturesSemainePrec > 0
          ? Math.round(
              ((candidaturesSemaine - candidaturesSemainePrec) / candidaturesSemainePrec) * 100
            )
          : null,
      installesMois,
      candidaturesParAnnonce: moyenne(enLigne.map((a) => a._count.candidatures), 1),
      scoreMoyen: moyenne(scores.map((s) => s.scoreAffinite ?? 0), 1),
      delaiQualificationH: moyenne(delaisQualif, 1),
      delaiInstallationJ: moyenne(delaisInstallation, 1),
    },

    contactsParCategorie: contactsParCategorie
      .map((c) => ({ categorie: c.categorie, n: c._count._all }))
      .sort((a, b) => b.n - a.n),

    taches: tachesDuJour,
    activite,
    acquisition: parQr
      .filter((q) => q.scans > 0 || q.candidatures > 0)
      .sort((a, b) => b.candidatures - a.candidatures),
  });
}
