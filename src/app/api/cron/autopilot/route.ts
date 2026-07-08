import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aiEnabled, generateMarketingPost } from "@/lib/ai";
import { computeStats, statsSummaryForAi } from "@/lib/stats";
import { publishPost, uniquePostSlug } from "@/lib/posts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Autopilote marketing : appelé par le cron Vercel (voir vercel.json).
 * Si AUTOPILOT=1 et ANTHROPIC_API_KEY configurée, Claude analyse les
 * statistiques récentes, rédige un nouveau post, le publie sur /news et
 * le relaie aux réseaux sociaux via le webhook. Zéro intervention humaine.
 *
 * Sécurité : Vercel envoie automatiquement "Authorization: Bearer CRON_SECRET"
 * si la variable CRON_SECRET est définie sur le projet.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  if (process.env.AUTOPILOT !== "1") {
    return NextResponse.json({ skipped: true, reason: "AUTOPILOT != 1" });
  }
  if (!aiEnabled()) {
    return NextResponse.json({ skipped: true, reason: "ANTHROPIC_API_KEY absente" });
  }

  const [stats, existingPosts, defaultQr] = await Promise.all([
    computeStats(undefined, 30),
    prisma.post.findMany({ select: { title: true }, orderBy: { createdAt: "desc" }, take: 15 }),
    prisma.qrCode.findFirst({ orderBy: { createdAt: "asc" } }),
  ]);

  const origin = process.env.APP_BASE_URL || req.nextUrl.origin;
  const trackedUrl = defaultQr
    ? `${origin}/${defaultQr.type === "link" ? "l" : "r"}/${defaultQr.slug}`
    : `${origin}/download`;

  try {
    const generated = await generateMarketingPost({
      statsSummary: statsSummaryForAi(stats),
      trackedUrl,
      existingTitles: existingPosts.map((p) => p.title),
    });

    const draft = await prisma.post.create({
      data: {
        title: generated.title,
        slug: await uniquePostSlug(generated.slug),
        excerpt: generated.excerpt,
        content: generated.content,
        hashtags: generated.hashtags.join(" "),
        aiGenerated: true,
        qrCodeId: defaultQr?.id ?? null,
      },
    });
    const post = await publishPost(draft.id, origin);

    return NextResponse.json({
      published: true,
      post: { id: post.id, title: post.title, url: `${origin}/news/${post.slug}` },
    });
  } catch (err) {
    console.error("Autopilote : échec de génération/publication :", err);
    return NextResponse.json({ error: "Échec de l'autopilote" }, { status: 502 });
  }
}
