import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ id: string }> };

/** Marque un document comme envoyé (traçabilité de ce qu'a reçu le propriétaire). */
export async function PATCH(req: NextRequest, { params }: P) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const document = await prisma.document.update({
      where: { id },
      data: {
        ...(body.type !== undefined ? { type: String(body.type) } : {}),
        ...(body.envoyeLe !== undefined
          ? { envoyeLe: body.envoyeLe ? new Date(String(body.envoyeLe)) : null }
          : {}),
        ...(body.canalEnvoi !== undefined
          ? { canalEnvoi: (body.canalEnvoi as string) || null }
          : {}),
      },
    });
    return NextResponse.json(document);
  } catch {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const { id } = await params;
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  // Supprime aussi le fichier du stockage quand il vient de Vercel Blob.
  if (process.env.BLOB_READ_WRITE_TOKEN && document.url.includes(".public.blob.vercel-storage.com")) {
    await del(document.url).catch(() => null);
  }
  await prisma.document.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
