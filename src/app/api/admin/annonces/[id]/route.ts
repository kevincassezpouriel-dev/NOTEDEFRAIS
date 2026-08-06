import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/actions";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: P) {
  const { id } = await params;
  const annonce = await prisma.annonce.findUnique({
    where: { id },
    include: {
      proprietaire: true,
      qrCode: { select: { id: true, slug: true, name: true } },
      candidatures: {
        orderBy: [{ scoreAffinite: "desc" }, { createdAt: "desc" }],
        include: { transmissions: true },
      },
    },
  });
  if (!annonce) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json(annonce);
}

export async function PATCH(req: NextRequest, { params }: P) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (k: string) => (body[k] !== undefined ? { [k]: (body[k] as string)?.trim() || null } : {});
  const num = (k: string) =>
    body[k] !== undefined ? { [k]: body[k] != null && body[k] !== "" ? Number(body[k]) : null } : {};

  const before = await prisma.annonce.findUnique({ where: { id }, select: { statut: true } });
  const passeEnLigne = body.statut === "en_ligne" && before?.statut !== "en_ligne";

  try {
    const annonce = await prisma.annonce.update({
      where: { id },
      data: {
        ...(body.titre !== undefined ? { titre: String(body.titre).trim() } : {}),
        ...str("referenceExterne"),
        ...str("quartier"),
        ...str("adresseApprox"),
        ...str("dureeMin"),
        ...str("profilColocataires"),
        ...str("description"),
        ...str("equipements"),
        ...str("photos"),
        ...num("loyer"),
        ...num("charges"),
        ...num("caution"),
        ...num("surfaceChambre"),
        ...num("surfaceTotale"),
        ...num("nbColocataires"),
        ...(body.meublee !== undefined ? { meublee: Boolean(body.meublee) } : {}),
        ...(body.dateDispo !== undefined
          ? { dateDispo: body.dateDispo ? new Date(body.dateDispo as string) : null }
          : {}),
        ...(body.statut !== undefined ? { statut: String(body.statut) } : {}),
        ...(passeEnLigne ? { publishedAt: new Date() } : {}),
      },
    });
    if (passeEnLigne) {
      await logAction({
        type: "annonce.publiee",
        title: `Annonce en ligne : ${annonce.titre}`,
        refType: "annonce",
        refId: id,
      });
    }
    if (body.statut === "pourvue" && before?.statut !== "pourvue") {
      await logAction({
        type: "annonce.pourvue",
        title: `Chambre pourvue : ${annonce.titre}`,
        refType: "annonce",
        refId: id,
      });
    }
    return NextResponse.json(annonce);
  } catch {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const { id } = await params;
  try {
    await prisma.annonce.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
}
