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

/** Qualification : score, statut, notes. Recalcule le score suggéré. */
export async function PATCH(req: NextRequest, { params }: P) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const current = await prisma.candidature.findUnique({
    where: { id },
    include: { annonce: { include: { proprietaire: { select: { briefRecherche: true } } } } },
  });
  if (!current) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const suggestion = suggestScore(current, current.annonce, current.annonce.proprietaire.briefRecherche);

  const candidature = await prisma.candidature.update({
    where: { id },
    data: {
      ...(body.scoreAffinite !== undefined
        ? { scoreAffinite: body.scoreAffinite === null ? null : Number(body.scoreAffinite) }
        : {}),
      ...(body.statut !== undefined ? { statut: String(body.statut) } : {}),
      ...(body.notesQualification !== undefined
        ? { notesQualification: (body.notesQualification as string)?.trim() || null }
        : {}),
      ...(body.garant !== undefined ? { garant: String(body.garant) } : {}),
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
