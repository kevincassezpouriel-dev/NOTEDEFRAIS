import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** File de qualification : filtrable par statut et par annonce. */
export async function GET(req: NextRequest) {
  const statut = req.nextUrl.searchParams.get("statut");
  const annonceId = req.nextUrl.searchParams.get("annonceId");
  const candidatures = await prisma.candidature.findMany({
    where: { ...(statut ? { statut } : {}), ...(annonceId ? { annonceId } : {}) },
    orderBy: [{ createdAt: "asc" }],
    take: 400,
    include: {
      annonce: {
        select: {
          id: true,
          titre: true,
          slug: true,
          loyer: true,
          charges: true,
          proprietaire: { select: { id: true, nom: true, briefRecherche: true } },
        },
      },
      transmissions: { select: { id: true, resultat: true, createdAt: true } },
    },
  });
  return NextResponse.json(candidatures);
}
