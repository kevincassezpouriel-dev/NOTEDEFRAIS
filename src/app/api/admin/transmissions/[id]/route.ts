import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/actions";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ id: string }> };

/** Met à jour le résultat. « accepté / installé » propage l'installation. */
export async function PATCH(req: NextRequest, { params }: P) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const transmission = await prisma.transmission.update({
      where: { id },
      data: {
        ...(body.resultat !== undefined
          ? { resultat: String(body.resultat), dateResultat: new Date() }
          : {}),
        ...(body.canal !== undefined ? { canal: String(body.canal) } : {}),
        ...(body.commentaire !== undefined
          ? { commentaire: (body.commentaire as string)?.trim() || null }
          : {}),
      },
      include: { candidature: { select: { id: true, nom: true } }, annonce: { select: { id: true, titre: true } } },
    });

    if (body.resultat === "accepte_installe") {
      await prisma.candidature.update({
        where: { id: transmission.candidatureId },
        data: { statut: "installe" },
      });
      await prisma.annonce.update({
        where: { id: transmission.annonceId },
        data: { statut: "pourvue" },
      });
    } else if (
      body.resultat === "refuse_par_coloc" ||
      body.resultat === "refuse_par_candidat"
    ) {
      await prisma.candidature.update({
        where: { id: transmission.candidatureId },
        data: { statut: "ecarte" },
      });
    }

    if (body.resultat !== undefined) {
      await logAction({
        type: "transmission.resultat",
        title: `${transmission.candidature.nom} → ${String(body.resultat).replace(/_/g, " ")}`,
        detail: transmission.annonce.titre,
        refType: "transmission",
        refId: id,
      });
    }
    return NextResponse.json(transmission);
  } catch {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const { id } = await params;
  try {
    await prisma.transmission.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
}
