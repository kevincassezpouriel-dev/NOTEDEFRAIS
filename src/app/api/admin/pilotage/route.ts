import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const JOURS_SANS_RETOUR = 4;
const JOURS_ANNONCE_MUETTE = 10;

/**
 * Les chiffres qui pilotent l'opération terrain — pas de décoration.
 * Chaque indicateur correspond à une action concrète à mener aujourd'hui.
 */
export async function GET() {
  const maintenant = new Date();
  const seuilRetour = new Date(maintenant.getTime() - JOURS_SANS_RETOUR * 86_400_000);
  const seuilMuette = new Date(maintenant.getTime() - JOURS_ANNONCE_MUETTE * 86_400_000);

  const [
    chambresEnLigne,
    aQualifier,
    qualifiesNonTransmis,
    sansRetour,
    relancesEnRetard,
    proprietairesTotal,
    proprietairesSpontanes,
    installes,
    tachesDuJour,
    activite,
    annoncesEnLigne,
    qrCodes,
  ] = await Promise.all([
    prisma.annonce.count({ where: { statut: "en_ligne" } }),
    prisma.candidature.count({ where: { statut: "a_qualifier" } }),
    prisma.candidature.count({ where: { statut: "qualifie" } }),
    prisma.transmission.count({
      where: { resultat: "en_attente", createdAt: { lt: seuilRetour } },
    }),
    prisma.contact.count({
      where: {
        categorie: "proprietaire",
        dateRelancePrevue: { lt: maintenant },
        statut: { notIn: ["accord_obtenu", "refus"] },
      },
    }),
    prisma.contact.count({ where: { categorie: "proprietaire" } }),
    prisma.contact.count({ where: { categorie: "proprietaire", source: "entrant_spontane" } }),
    prisma.candidature.count({ where: { statut: "installe" } }),
    prisma.tache.findMany({
      where: { done: false },
      orderBy: [{ dueAt: "asc" }],
      take: 12,
      include: { contact: { select: { id: true, nom: true } } },
    }),
    prisma.action.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.annonce.findMany({
      where: { statut: "en_ligne" },
      select: {
        id: true,
        titre: true,
        publishedAt: true,
        qrCodeId: true,
        _count: { select: { candidatures: true } },
      },
    }),
    prisma.qrCode.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { scans: true } },
      },
    }),
  ]);

  // Annonces en ligne depuis 10 jours sans la moindre candidature.
  const annoncesMuettes = annoncesEnLigne.filter(
    (a) => a._count.candidatures === 0 && a.publishedAt != null && a.publishedAt < seuilMuette
  );

  // Performance par point d'acquisition : scans → candidatures → installés.
  const parQr = await Promise.all(
    qrCodes.map(async (qr) => {
      const annonceIds = annoncesEnLigne.filter((a) => a.qrCodeId === qr.id).map((a) => a.id);
      const [candidatures, installes] = await Promise.all([
        annonceIds.length
          ? prisma.candidature.count({ where: { annonceId: { in: annonceIds } } })
          : prisma.candidature.count({ where: { campagneSource: { contains: qr.slug } } }),
        annonceIds.length
          ? prisma.candidature.count({ where: { annonceId: { in: annonceIds }, statut: "installe" } })
          : 0,
      ]);
      return {
        id: qr.id,
        name: qr.name,
        slug: qr.slug,
        scans: qr._count.scans,
        candidatures,
        installes,
      };
    })
  );

  return NextResponse.json({
    chambresEnLigne,
    aQualifier,
    qualifiesNonTransmis,
    sansRetour,
    relancesEnRetard,
    installes,
    proprietairesTotal,
    proprietairesSpontanes,
    partSpontanee:
      proprietairesTotal > 0 ? Math.round((proprietairesSpontanes / proprietairesTotal) * 100) : 0,
    annoncesMuettes: annoncesMuettes.map((a) => ({ id: a.id, titre: a.titre })),
    taches: tachesDuJour,
    activite,
    acquisition: parQr.filter((q) => q.scans > 0 || q.candidatures > 0).sort((a, b) => b.candidatures - a.candidatures),
  });
}
