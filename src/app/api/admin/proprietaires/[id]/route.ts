import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/actions";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ id: string }> };

/** Fiche 360 : le propriétaire, ses annonces, toutes les candidatures
 *  reçues sur ses annonces, ses transmissions, ses documents, son journal. */
export async function GET(_req: NextRequest, { params }: P) {
  const { id } = await params;
  const proprietaire = await prisma.proprietaire.findUnique({
    where: { id },
    include: {
      annonces: {
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { candidatures: true } },
          candidatures: {
            orderBy: [{ scoreAffinite: "desc" }, { createdAt: "desc" }],
            include: { transmissions: true },
          },
        },
      },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!proprietaire) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const journal = await prisma.action.findMany({
    where: {
      OR: [
        { refType: "proprietaire", refId: id },
        { refType: "annonce", refId: { in: proprietaire.annonces.map((a) => a.id) } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ ...proprietaire, journal });
}

export async function PATCH(req: NextRequest, { params }: P) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (k: string) => (body[k] !== undefined ? { [k]: (body[k] as string)?.trim() || null } : {});
  const date = (k: string) =>
    body[k] !== undefined ? { [k]: body[k] ? new Date(body[k] as string) : null } : {};

  const before = await prisma.proprietaire.findUnique({ where: { id }, select: { statut: true } });
  try {
    const proprietaire = await prisma.proprietaire.update({
      where: { id },
      data: {
        ...(body.nom !== undefined ? { nom: String(body.nom).trim() } : {}),
        ...str("telephone"),
        ...str("email"),
        ...str("quartier"),
        ...str("briefRecherche"),
        ...str("notes"),
        ...str("accordPreuve"),
        ...(body.type !== undefined ? { type: String(body.type) } : {}),
        ...(body.source !== undefined ? { source: String(body.source) } : {}),
        ...(body.statut !== undefined ? { statut: String(body.statut) } : {}),
        ...(body.accordEcrit !== undefined ? { accordEcrit: Boolean(body.accordEcrit) } : {}),
        ...date("datePremierContact"),
        ...date("dateRelancePrevue"),
        dateDerniereAction: new Date(),
      },
    });
    if (body.statut !== undefined && before && before.statut !== proprietaire.statut) {
      await logAction({
        type: "proprietaire.statut",
        title: `${proprietaire.nom} → ${proprietaire.statut.replace(/_/g, " ")}`,
        refType: "proprietaire",
        refId: id,
      });
    }
    return NextResponse.json(proprietaire);
  } catch {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const { id } = await params;
  try {
    await prisma.proprietaire.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
}
