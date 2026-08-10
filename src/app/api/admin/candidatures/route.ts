import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/actions";
import { suggestScore } from "@/lib/crm";

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

/**
 * Ajout MANUEL d'un candidat : quand on l'a eu au téléphone, croisé sur le
 * terrain ou reçu par message. Mêmes champs que le formulaire public, mais
 * sans le minimum de motivation — c'est l'opérateur qui saisit.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const annonceId = String(body.annonceId ?? "");
  const nom = String(body.nom ?? "").trim();
  if (!annonceId || !nom) {
    return NextResponse.json({ error: "Annonce et nom obligatoires" }, { status: 400 });
  }

  const annonce = await prisma.annonce.findUnique({
    where: { id: annonceId },
    include: { proprietaire: { select: { briefRecherche: true } } },
  });
  if (!annonce) return NextResponse.json({ error: "Annonce introuvable" }, { status: 404 });

  const clamp = (v: unknown, def: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : def;
  };
  const profil = {
    statutPro: String(body.statutPro ?? "etudiant"),
    ecoleEmployeur: String(body.ecoleEmployeur ?? "").trim() || null,
    budgetMax: body.budgetMax ? Number(body.budgetMax) : null,
    dateDispo: body.dateDispo ? new Date(String(body.dateDispo)) : null,
    dureeSouhaitee: String(body.dureeSouhaitee ?? "").trim() || null,
    garant: String(body.garant ?? "a_verifier"),
    rythme: String(body.rythme ?? "flexible"),
    menage: clamp(body.menage, 3),
    invites: String(body.invites ?? "parfois"),
    fetes: clamp(body.fetes, 3),
    fumeur: Boolean(body.fumeur),
    animaux: Boolean(body.animaux),
    motivation: String(body.motivation ?? "").trim() || "(saisi manuellement)",
  };
  const suggestion = suggestScore(profil, annonce, annonce.proprietaire.briefRecherche);

  const candidature = await prisma.candidature.create({
    data: {
      annonceId,
      nom,
      email: String(body.email ?? "").trim().toLowerCase() || `${Date.now()}@saisie-manuelle.local`,
      telephone: String(body.telephone ?? "").trim() || null,
      ...profil,
      origine: "manuel",
      campagneSource: String(body.campagneSource ?? "").trim() || "saisie manuelle",
      notesQualification: String(body.notesQualification ?? "").trim() || null,
      scoreSuggere: suggestion.score,
      scoreRaisons: suggestion.raisons.join("\n"),
    },
  });

  await logAction({
    type: "candidature.recue",
    title: `Candidat ajouté à la main : ${nom}`,
    detail: `${annonce.titre} · score suggéré ${suggestion.score}/5`,
    refType: "candidature",
    refId: candidature.id,
    status: "pending",
  });
  return NextResponse.json(candidature, { status: 201 });
}
