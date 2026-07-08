import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aiEnabled, generateMarketingPost } from "@/lib/ai";
import { computeStats, statsSummaryForAi } from "@/lib/stats";
import { uniquePostSlug } from "@/lib/posts";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // la génération Opus peut prendre >10 s

/**
 * Génère un brouillon de post marketing avec Claude.
 * Body : { brief?: string, qrCodeId?: string, useStats?: boolean }
 */
export async function POST(req: NextRequest) {
  if (!aiEnabled()) {
    return NextResponse.json(
      {
        error:
          "IA non configurée : ajoutez la variable d'environnement ANTHROPIC_API_KEY (clé sur console.anthropic.com) puis redéployez.",
      },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    brief?: string;
    qrCodeId?: string;
    useStats?: boolean;
  };

  const qr = body.qrCodeId
    ? await prisma.qrCode.findUnique({ where: { id: body.qrCodeId } })
    : null;

  const [existingPosts, statsSummary] = await Promise.all([
    prisma.post.findMany({ select: { title: true }, orderBy: { createdAt: "desc" }, take: 10 }),
    body.useStats !== false
      ? computeStats(undefined, 30).then(statsSummaryForAi)
      : Promise.resolve(undefined),
  ]);

  const origin = process.env.APP_BASE_URL || req.nextUrl.origin;
  const trackedUrl = qr
    ? `${origin}/${qr.type === "link" ? "l" : "r"}/${qr.slug}`
    : `${origin}/download`;

  try {
    const generated = await generateMarketingPost({
      brief: body.brief?.trim() || undefined,
      campaignName: qr?.name,
      trackedUrl,
      statsSummary,
      existingTitles: existingPosts.map((p) => p.title),
    });

    const post = await prisma.post.create({
      data: {
        title: generated.title,
        slug: await uniquePostSlug(generated.slug),
        excerpt: generated.excerpt,
        content: generated.content,
        hashtags: generated.hashtags.join(" "),
        aiGenerated: true,
        qrCodeId: qr?.id ?? null,
      },
    });
    return NextResponse.json(post, { status: 201 });
  } catch (err) {
    console.error("Erreur de génération IA :", err);
    return NextResponse.json(
      { error: "La génération a échoué. Vérifiez la clé API et réessayez." },
      { status: 502 }
    );
  }
}
