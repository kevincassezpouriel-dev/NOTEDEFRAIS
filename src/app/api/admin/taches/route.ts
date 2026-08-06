import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

/** Tâches ouvertes (par défaut) ou toutes, triées par échéance. */
export async function GET(req: NextRequest) {
  const toutes = req.nextUrl.searchParams.get("toutes") === "1";
  const taches = await prisma.tache.findMany({
    where: toutes ? {} : { done: false },
    orderBy: [{ done: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: { contact: { select: { id: true, nom: true, categorie: true } } },
  });
  return NextResponse.json(taches);
}

/** Crée une tâche/relance. Body : { titre, dueAt?, priorite?, contactId? } */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const titre = String(body.titre ?? "").trim();
  if (!titre) return NextResponse.json({ error: "Titre obligatoire" }, { status: 400 });

  const tache = await prisma.tache.create({
    data: {
      titre,
      contactId: (body.contactId as string) || null,
      dueAt: body.dueAt ? new Date(String(body.dueAt)) : null,
      priorite: (body.priorite as string) || "normale",
    },
  });
  await logAction({
    type: "tache.creee",
    title: `Tâche : ${titre}`,
    refType: "contact",
    refId: (body.contactId as string) || null,
    status: "pending",
  });
  return NextResponse.json(tache, { status: 201 });
}
