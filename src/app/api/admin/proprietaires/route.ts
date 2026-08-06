import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

/** Liste des propriétaires (filtrable) avec le compte de leurs annonces. */
export async function GET(req: NextRequest) {
  const statut = req.nextUrl.searchParams.get("statut");
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const proprietaires = await prisma.proprietaire.findMany({
    where: {
      ...(statut ? { statut } : {}),
      ...(q
        ? {
            OR: [
              { nom: { contains: q, mode: "insensitive" as const } },
              { quartier: { contains: q, mode: "insensitive" as const } },
              { telephone: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: [{ dateRelancePrevue: "asc" }, { createdAt: "desc" }],
    take: 300,
    include: { _count: { select: { annonces: true } } },
  });
  return NextResponse.json(proprietaires);
}

/** Crée un propriétaire. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const nom = String(body.nom ?? "").trim();
  if (!nom) return NextResponse.json({ error: "Le nom est obligatoire" }, { status: 400 });

  const proprietaire = await prisma.proprietaire.create({
    data: {
      nom,
      telephone: (body.telephone as string)?.trim() || null,
      email: (body.email as string)?.trim() || null,
      type: (body.type as string) || "proprietaire_particulier",
      source: (body.source as string) || "terrain",
      quartier: (body.quartier as string)?.trim() || null,
      statut: (body.statut as string) || "a_contacter",
      briefRecherche: (body.briefRecherche as string)?.trim() || null,
      notes: (body.notes as string)?.trim() || null,
      dateDerniereAction: new Date(),
    },
  });
  await logAction({
    type: "proprietaire.cree",
    title: `Propriétaire ajouté : ${proprietaire.nom}`,
    refType: "proprietaire",
    refId: proprietaire.id,
  });
  return NextResponse.json(proprietaire, { status: 201 });
}
