import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/actions";
import { slugify } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** Slug d'annonce unique. */
async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "chambre";
  let slug = root;
  for (let i = 2; i < 200; i++) {
    const exists = await prisma.annonce.findUnique({ where: { slug }, select: { id: true } });
    if (!exists) return slug;
    slug = `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

export async function GET(req: NextRequest) {
  const statut = req.nextUrl.searchParams.get("statut");
  const proprietaireId = req.nextUrl.searchParams.get("proprietaireId");
  const annonces = await prisma.annonce.findMany({
    where: { ...(statut ? { statut } : {}), ...(proprietaireId ? { proprietaireId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      proprietaire: { select: { id: true, nom: true, briefRecherche: true } },
      qrCode: { select: { id: true, slug: true, name: true } },
      _count: { select: { candidatures: true } },
    },
  });
  return NextResponse.json(annonces);
}

/** Crée une annonce ET son QR/lien tracké dédié. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const titre = String(body.titre ?? "").trim();
  const proprietaireId = String(body.proprietaireId ?? "");
  if (!titre || !proprietaireId) {
    return NextResponse.json({ error: "Titre et propriétaire obligatoires" }, { status: 400 });
  }
  const proprietaire = await prisma.contact.findUnique({ where: { id: proprietaireId } });
  if (!proprietaire) return NextResponse.json({ error: "Propriétaire introuvable" }, { status: 404 });

  const slug = await uniqueSlug(titre);
  const origin = process.env.APP_BASE_URL || req.nextUrl.origin;

  // QR/lien tracké dédié : c'est lui qui alimente « quel flyer convertit ».
  const qrCode = await prisma.qrCode.create({
    data: {
      name: `Annonce — ${titre}`.slice(0, 90),
      slug: `a-${slug}`.slice(0, 60),
      type: "qr",
      channel: "annonce",
      appStoreUrl: process.env.APP_STORE_URL || `${origin}/colocations/${slug}`,
      playStoreUrl: process.env.PLAY_STORE_URL || `${origin}/colocations/${slug}`,
      fallbackUrl: `${origin}/colocations/${slug}`,
    },
  });

  const num = (k: string) => (body[k] != null && body[k] !== "" ? Number(body[k]) : null);
  const annonce = await prisma.annonce.create({
    data: {
      proprietaireId,
      titre,
      slug,
      qrCodeId: qrCode.id,
      referenceExterne: (body.referenceExterne as string)?.trim() || null,
      quartier: (body.quartier as string)?.trim() || proprietaire.quartier,
      adresseApprox: (body.adresseApprox as string)?.trim() || null,
      loyer: num("loyer"),
      charges: num("charges"),
      caution: num("caution"),
      surfaceChambre: num("surfaceChambre"),
      surfaceTotale: num("surfaceTotale"),
      meublee: Boolean(body.meublee),
      dateDispo: body.dateDispo ? new Date(body.dateDispo as string) : null,
      dureeMin: (body.dureeMin as string)?.trim() || null,
      nbColocataires: num("nbColocataires"),
      profilColocataires: (body.profilColocataires as string)?.trim() || null,
      description: (body.description as string)?.trim() || null,
      equipements: (body.equipements as string)?.trim() || null,
      photos: (body.photos as string)?.trim() || null,
    },
  });
  await logAction({
    type: "annonce.creee",
    title: `Annonce créée : ${annonce.titre}`,
    detail: `Propriétaire : ${proprietaire.nom}`,
    refType: "annonce",
    refId: annonce.id,
  });
  return NextResponse.json(annonce, { status: 201 });
}
