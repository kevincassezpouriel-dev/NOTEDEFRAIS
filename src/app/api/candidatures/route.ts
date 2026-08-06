import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/actions";
import { suggestScore } from "@/lib/crm";

export const dynamic = "force-dynamic";

const MOTIVATION_MIN = 100;

/**
 * Endpoint PUBLIC : dépôt d'une candidature depuis le formulaire d'une
 * annonce. Le candidat n'obtient JAMAIS de coordonnées du propriétaire ;
 * la réponse ne renvoie qu'une confirmation.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const annonceSlug = String(body.annonceSlug ?? "").trim();
  const nom = String(body.nom ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const motivation = String(body.motivation ?? "").trim();

  if (!annonceSlug) return NextResponse.json({ error: "Annonce introuvable" }, { status: 400 });
  if (nom.length < 2) return NextResponse.json({ error: "Indique ton nom" }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) {
    return NextResponse.json({ error: "E-mail invalide" }, { status: 400 });
  }
  if (motivation.length < MOTIVATION_MIN) {
    return NextResponse.json(
      { error: `Ta motivation doit faire au moins ${MOTIVATION_MIN} caractères (${motivation.length} pour l'instant).` },
      { status: 400 }
    );
  }
  // Anti-spam simple : champ piège rempli = robot.
  if (String(body.website ?? "").trim()) return NextResponse.json({ ok: true });

  const annonce = await prisma.annonce.findUnique({
    where: { slug: annonceSlug },
    include: { proprietaire: { select: { id: true, nom: true, briefRecherche: true } } },
  });
  if (!annonce || annonce.statut !== "en_ligne") {
    return NextResponse.json({ error: "Cette annonce n'est plus disponible" }, { status: 404 });
  }

  const clamp = (v: unknown, min: number, max: number, def: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def;
  };
  const profil = {
    statutPro: String(body.statutPro ?? "etudiant"),
    ecoleEmployeur: String(body.ecoleEmployeur ?? "").trim() || null,
    budgetMax: body.budgetMax ? Number(body.budgetMax) : null,
    dateDispo: body.dateDispo ? new Date(String(body.dateDispo)) : null,
    dureeSouhaitee: String(body.dureeSouhaitee ?? "").trim() || null,
    garant: String(body.garant ?? "a_verifier"),
    rythme: String(body.rythme ?? "flexible"),
    menage: clamp(body.menage, 1, 5, 3),
    invites: String(body.invites ?? "parfois"),
    fetes: clamp(body.fetes, 1, 5, 3),
    fumeur: Boolean(body.fumeur),
    animaux: Boolean(body.animaux),
    motivation,
  };

  // Score suggéré calculé dès la réception : la file de qualification est
  // déjà pré-triée quand l'opérateur l'ouvre.
  const suggestion = suggestScore(profil, annonce, annonce.proprietaire.briefRecherche);

  const candidature = await prisma.candidature.create({
    data: {
      annonceId: annonce.id,
      nom,
      email,
      telephone: String(body.telephone ?? "").trim() || null,
      ...profil,
      campagneSource: String(body.source ?? "").trim().slice(0, 80) || null,
      scoreSuggere: suggestion.score,
      scoreRaisons: suggestion.raisons.join("\n"),
    },
  });

  await logAction({
    type: "candidature.recue",
    actor: "system",
    title: `Nouvelle candidature : ${nom}`,
    detail: `${annonce.titre} · score suggéré ${suggestion.score}/5`,
    refType: "candidature",
    refId: candidature.id,
    status: "pending",
  });

  return NextResponse.json({ ok: true });
}
