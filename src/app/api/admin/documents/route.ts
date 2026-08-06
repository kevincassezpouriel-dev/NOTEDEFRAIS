import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

/** Documents d'un contact ou d'une candidature. */
export async function GET(req: NextRequest) {
  const contactId = req.nextUrl.searchParams.get("contactId");
  const candidatureId = req.nextUrl.searchParams.get("candidatureId");
  const documents = await prisma.document.findMany({
    where: {
      ...(contactId ? { proprietaireId: contactId } : {}),
      ...(candidatureId ? { candidatureId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(documents);
}

/** Enregistre un document déjà téléversé (Blob) ou un simple lien externe. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const url = String(body.url ?? "").trim();
  const nomFichier = String(body.nomFichier ?? "").trim();
  if (!url || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: "URL de document invalide" }, { status: 400 });
  }
  if (!body.contactId && !body.candidatureId) {
    return NextResponse.json({ error: "Rattachement manquant" }, { status: 400 });
  }

  const document = await prisma.document.create({
    data: {
      proprietaireId: (body.contactId as string) || null,
      candidatureId: (body.candidatureId as string) || null,
      type: (body.type as string) || "autre",
      nomFichier: nomFichier || url.split("/").pop() || "document",
      url,
    },
  });
  await logAction({
    type: "document.ajoute",
    title: `Document ajouté : ${document.nomFichier}`,
    refType: body.contactId ? "contact" : "candidature",
    refId: (body.contactId as string) || (body.candidatureId as string) || null,
  });
  return NextResponse.json(document, { status: 201 });
}
