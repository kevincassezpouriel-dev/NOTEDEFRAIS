import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/actions";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: P) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const tache = await prisma.tache.update({
      where: { id },
      data: {
        ...(body.titre !== undefined ? { titre: String(body.titre).trim() } : {}),
        ...(body.priorite !== undefined ? { priorite: String(body.priorite) } : {}),
        ...(body.dueAt !== undefined
          ? { dueAt: body.dueAt ? new Date(String(body.dueAt)) : null }
          : {}),
        ...(body.done !== undefined
          ? { done: Boolean(body.done), doneAt: body.done ? new Date() : null }
          : {}),
      },
    });
    if (body.done === true) {
      await logAction({
        type: "tache.faite",
        title: `Tâche faite : ${tache.titre}`,
        refType: "contact",
        refId: tache.contactId,
      });
    }
    return NextResponse.json(tache);
  } catch {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const { id } = await params;
  try {
    await prisma.tache.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
}
