import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aiEnabled, generateMarketingPost } from "@/lib/ai";
import { computeStats, statsSummaryForAi } from "@/lib/stats";
import { createPost } from "@/lib/posts";
import { topLearnings } from "@/lib/learnings";
import { assetUrl } from "@/lib/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Génère un brouillon de post marketing avec Claude, en appliquant les
 * apprentissages accumulés. Body : { brief?, qrCodeId?, campaignId?, useStats? }
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
    campaignId?: string;
    useStats?: boolean;
  };

  const [qr, campaign] = await Promise.all([
    body.qrCodeId
      ? prisma.qrCode.findUnique({ where: { id: body.qrCodeId } })
      : Promise.resolve(null),
    body.campaignId
      ? prisma.campaign.findUnique({ where: { id: body.campaignId } })
      : Promise.resolve(null),
  ]);

  const [existingPosts, statsSummary, learnings] = await Promise.all([
    prisma.post.findMany({ select: { title: true }, orderBy: { createdAt: "desc" }, take: 10 }),
    body.useStats !== false
      ? computeStats(undefined, 30).then(statsSummaryForAi)
      : Promise.resolve(undefined),
    topLearnings(),
  ]);

  const origin = process.env.APP_BASE_URL || req.nextUrl.origin;
  const trackedUrl = assetUrl(origin, qr);
  const resolvedCampaignId = campaign?.id ?? qr?.campaignId ?? null;

  try {
    const generated = await generateMarketingPost({
      brief: body.brief?.trim() || undefined,
      campaignName: campaign?.name ?? qr?.name,
      campaignObjective: campaign?.objective ?? undefined,
      trackedUrl,
      statsSummary,
      existingTitles: existingPosts.map((p) => p.title),
      learnings,
    });

    const post = await createPost({
      title: generated.title,
      slug: generated.slug,
      excerpt: generated.excerpt,
      content: generated.content,
      hashtags: generated.hashtags.join(" "),
      qrCodeId: qr?.id ?? null,
      campaignId: resolvedCampaignId,
      aiGenerated: true,
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
