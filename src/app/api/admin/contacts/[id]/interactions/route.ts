import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

/** Journalise un échange avec un contact (appel, message, rdv, visite…). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const resume = String(body.resume ?? "").trim();
  if (!resume) return NextResponse.json({ error: "Résumé obligatoire" }, { status: 400 });

  const contact = await prisma.contact.findUnique({ where: { id }, select: { nom: true } });
  if (!contact) return NextResponse.json({ error: "Contact introuvable" }, { status: 404 });

  const interaction = await prisma.interaction.create({
    data: {
      contactId: id,
      type: (body.type as string) || "appel",
      sens: (body.sens as string) || "sortant",
      resume,
    },
  });
  // Tout échange rafraîchit la date de dernière action du contact.
  await prisma.contact.update({
    where: { id },
    data: {
      dateDerniereAction: new Date(),
      ...(body.dateRelancePrevue !== undefined
        ? {
            dateRelancePrevue: body.dateRelancePrevue
              ? new Date(String(body.dateRelancePrevue))
              : null,
          }
        : {}),
    },
  });
  await logAction({
    type: "interaction.ajoutee",
    title: `${interaction.type} — ${contact.nom}`,
    detail: resume.slice(0, 200),
    refType: "contact",
    refId: id,
  });
  return NextResponse.json(interaction, { status: 201 });
}
