import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/actions";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ id: string }> };

/** Fiche 360 : le propriétaire, ses annonces, toutes les candidatures
 *  reçues sur ses annonces, ses transmissions, ses documents, son journal. */
export async function GET(_req: NextRequest, { params }: P) {
  const { id } = await params;
  const contact = await prisma.contact.findUnique({
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
      interactions: { orderBy: { createdAt: "desc" }, take: 100 },
      taches: { orderBy: [{ done: "asc" }, { dueAt: "asc" }] },
    },
  });
  if (!contact) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const journal = await prisma.action.findMany({
    where: {
      OR: [
        { refType: "contact", refId: id },
        { refType: "annonce", refId: { in: contact.annonces.map((a: { id: string }) => a.id) } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ ...contact, journal });
}

export async function PATCH(req: NextRequest, { params }: P) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (k: string) => (body[k] !== undefined ? { [k]: (body[k] as string)?.trim() || null } : {});
  const date = (k: string) =>
    body[k] !== undefined ? { [k]: body[k] ? new Date(body[k] as string) : null } : {};

  const before = await prisma.contact.findUnique({ where: { id }, select: { statut: true } });
  try {
    const contact = await prisma.contact.update({
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
        ...(body.categorie !== undefined ? { categorie: String(body.categorie) } : {}),
        ...str("organisation"),
        ...str("tags"),
        ...(body.source !== undefined ? { source: String(body.source) } : {}),
        ...(body.statut !== undefined ? { statut: String(body.statut) } : {}),
        ...(body.accordEcrit !== undefined ? { accordEcrit: Boolean(body.accordEcrit) } : {}),
        ...date("datePremierContact"),
        ...date("dateRelancePrevue"),
        dateDerniereAction: new Date(),
      },
    });
    if (body.statut !== undefined && before && before.statut !== contact.statut) {
      await logAction({
        type: "contact.statut",
        title: `${contact.nom} → ${contact.statut.replace(/_/g, " ")}`,
        refType: "contact",
        refId: id,
      });
    }
    return NextResponse.json(contact);
  } catch {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const { id } = await params;
  try {
    await prisma.contact.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
}
