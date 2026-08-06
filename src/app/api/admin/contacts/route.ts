import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

/** Liste des propriétaires (filtrable) avec le compte de leurs annonces. */
export async function GET(req: NextRequest) {
  const statut = req.nextUrl.searchParams.get("statut");
  const categorie = req.nextUrl.searchParams.get("categorie");
  const tag = req.nextUrl.searchParams.get("tag")?.trim();
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const contacts = await prisma.contact.findMany({
    where: {
      ...(statut ? { statut } : {}),
      ...(categorie ? { categorie } : {}),
      ...(tag ? { tags: { contains: tag, mode: "insensitive" as const } } : {}),
      ...(q
        ? {
            OR: [
              { nom: { contains: q, mode: "insensitive" as const } },
              { organisation: { contains: q, mode: "insensitive" as const } },
              { quartier: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
              { telephone: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: [{ dateRelancePrevue: "asc" }, { createdAt: "desc" }],
    take: 300,
    include: { _count: { select: { annonces: true, interactions: true } } },
  });
  return NextResponse.json(contacts);
}

/** Crée un propriétaire. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const nom = String(body.nom ?? "").trim();
  if (!nom) return NextResponse.json({ error: "Le nom est obligatoire" }, { status: 400 });

  const contact = await prisma.contact.create({
    data: {
      nom,
      categorie: (body.categorie as string) || "proprietaire",
      organisation: (body.organisation as string)?.trim() || null,
      tags: (body.tags as string)?.trim() || null,
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
    type: "contact.cree",
    title: `Contact ajouté : ${contact.nom}`,
    detail: contact.categorie,
    refType: "contact",
    refId: contact.id,
  });
  return NextResponse.json(contact, { status: 201 });
}
