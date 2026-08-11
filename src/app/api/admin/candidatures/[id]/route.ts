import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/actions";
import { suggestScore } from "@/lib/crm";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: P) {
  const { id } = await params;
  const candidature = await prisma.candidature.findUnique({
    where: { id },
    include: {
      annonce: { include: { proprietaire: true } },
      transmissions: { orderBy: { createdAt: "desc" } },
      documents: true,
    },
  });
  if (!candidature) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json(candidature);
}

/**
 * Qualification (score, statut, notes) et correction du profil : après un appel
 * on rattrape souvent un numéro mal noté ou un budget qui a bougé. Le score
 * suggéré est recalculé sur les valeurs corrigées, pas sur les anciennes.
 */
export async function PATCH(req: NextRequest, { params }: P) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const current = await prisma.candidature.findUnique({
    where: { id },
    include: { annonce: { include: { proprietaire: { select: { briefRecherche: true } } } } },
  });
  if (!current) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const texte = (k: string) => (body[k] !== undefined ? { [k]: String(body[k]).trim() || null } : {});
  const entier = (k: string) => {
    if (body[k] === undefined) return {};
    const n = Number(body[k]);
    return { [k]: body[k] === null || body[k] === "" || Number.isNaN(n) ? null : n };
  };
  const jauge = (k: string) => {
    if (body[k] === undefined) return {};
    return { [k]: Math.min(5, Math.max(1, Number(body[k]) || 3)) };
  };

  const identite = {
    ...(body.nom !== undefined && String(body.nom).trim()
      ? { nom: String(body.nom).trim() }
      : {}),
    ...(body.email !== undefined && String(body.email).trim()
      ? { email: String(body.email).trim() }
      : {}),
    ...texte("telephone"),
    ...texte("ecoleEmployeur"),
    ...texte("dureeSouhaitee"),
    ...(body.motivation !== undefined && String(body.motivation).trim()
      ? { motivation: String(body.motivation).trim() }
      : {}),
  };

  const profil = {
    ...(body.statutPro !== undefined ? { statutPro: String(body.statutPro) } : {}),
    ...(body.garant !== undefined ? { garant: String(body.garant) } : {}),
    ...(body.rythme !== undefined ? { rythme: String(body.rythme) } : {}),
    ...(body.invites !== undefined ? { invites: String(body.invites) } : {}),
    ...jauge("menage"),
    ...jauge("fetes"),
    ...entier("budgetMax"),
    ...(body.fumeur !== undefined ? { fumeur: Boolean(body.fumeur) } : {}),
    ...(body.animaux !== undefined ? { animaux: Boolean(body.animaux) } : {}),
    ...(body.dateDispo !== undefined
      ? { dateDispo: body.dateDispo ? new Date(String(body.dateDispo)) : null }
      : {}),
  };

  // Le score se juge sur le profil tel qu'il sera après la mise à jour.
  const suggestion = suggestScore(
    { ...current, ...identite, ...profil },
    current.annonce,
    current.annonce.proprietaire.briefRecherche
  );

  const candidature = await prisma.candidature.update({
    where: { id },
    data: {
      ...identite,
      ...profil,
      ...(body.scoreAffinite !== undefined
        ? { scoreAffinite: body.scoreAffinite === null ? null : Number(body.scoreAffinite) }
        : {}),
      ...(body.statut !== undefined ? { statut: String(body.statut) } : {}),
      ...(body.notesQualification !== undefined
        ? { notesQualification: (body.notesQualification as string)?.trim() || null }
        : {}),
      scoreSuggere: suggestion.score,
      scoreRaisons: suggestion.raisons.join("\n"),
    },
  });

  if (body.statut === "qualifie" || body.scoreAffinite !== undefined) {
    await logAction({
      type: "candidature.qualifiee",
      title: `Candidature qualifiée : ${candidature.nom}`,
      detail: `Score ${candidature.scoreAffinite ?? "—"}/5`,
      refType: "candidature",
      refId: id,
    });
  }
  return NextResponse.json(candidature);
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const { id } = await params;
  try {
    await prisma.candidature.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
}
