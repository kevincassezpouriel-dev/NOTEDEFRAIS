import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

/** Limite métier : on ne transmet jamais plus de 3 profils par annonce. */
const MAX_PAR_ANNONCE = 3;

export async function GET(req: NextRequest) {
  const resultat = req.nextUrl.searchParams.get("resultat");
  const transmissions = await prisma.transmission.findMany({
    where: resultat ? { resultat } : {},
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      candidature: { select: { id: true, nom: true, scoreAffinite: true, telephone: true, email: true } },
      annonce: {
        select: {
          id: true,
          titre: true,
          proprietaire: { select: { id: true, nom: true, telephone: true } },
        },
      },
    },
  });
  return NextResponse.json(transmissions);
}

/** Transmet un candidat au propriétaire. Body : { candidatureId, canal, commentaire? } */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const candidatureId = String(body.candidatureId ?? "");
  if (!candidatureId) return NextResponse.json({ error: "candidatureId requis" }, { status: 400 });

  const candidature = await prisma.candidature.findUnique({
    where: { id: candidatureId },
    include: { annonce: { include: { proprietaire: true } } },
  });
  if (!candidature) return NextResponse.json({ error: "Candidature introuvable" }, { status: 404 });

  const dejaTransmis = await prisma.transmission.count({
    where: { annonceId: candidature.annonceId },
  });
  if (dejaTransmis >= MAX_PAR_ANNONCE && body.force !== true) {
    return NextResponse.json(
      {
        error: `Déjà ${dejaTransmis} profils transmis sur cette annonce (maximum conseillé : ${MAX_PAR_ANNONCE}).`,
        needsForce: true,
      },
      { status: 409 }
    );
  }

  const transmission = await prisma.transmission.create({
    data: {
      candidatureId,
      annonceId: candidature.annonceId,
      canal: (body.canal as string) || "whatsapp",
      commentaire: (body.commentaire as string)?.trim() || null,
    },
  });
  await prisma.candidature.update({ where: { id: candidatureId }, data: { statut: "transmis" } });
  await prisma.contact.update({
    where: { id: candidature.annonce.proprietaireId },
    data: { dateDerniereAction: new Date() },
  });
  await logAction({
    type: "transmission.envoyee",
    title: `${candidature.nom} transmis à ${candidature.annonce.proprietaire.nom}`,
    detail: `Annonce : ${candidature.annonce.titre}`,
    refType: "transmission",
    refId: transmission.id,
  });
  return NextResponse.json(transmission, { status: 201 });
}
