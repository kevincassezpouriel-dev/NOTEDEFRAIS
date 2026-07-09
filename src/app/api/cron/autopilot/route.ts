import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runMarketingCycle } from "@/lib/engine";
import { publishPost } from "@/lib/posts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron principal (voir vercel.json). Deux missions à chaque passage :
 *   1. Publier les posts programmés dont l'heure est venue (calendrier).
 *   2. Exécuter un cycle d'autopilote (analyse → apprentissage → rédaction →
 *      publication ou validation) selon le mode configuré.
 *
 * Sécurité : si CRON_SECRET est défini, Vercel envoie "Authorization: Bearer …".
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const origin = process.env.APP_BASE_URL || req.nextUrl.origin;

  // 1. Publication programmée
  const due = await prisma.post.findMany({
    where: { status: "scheduled", scheduledAt: { lte: new Date() } },
    select: { id: true },
  });
  for (const p of due) {
    await publishPost(p.id, origin).catch((e) => console.error("Publication programmée :", e));
  }

  // 2. Cycle d'autopilote
  const cycle = await runMarketingCycle(origin);

  return NextResponse.json({ scheduledPublished: due.length, cycle });
}
