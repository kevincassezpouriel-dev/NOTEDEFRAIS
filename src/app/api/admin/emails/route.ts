import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aiEnabled, generateEmailCampaign } from "@/lib/ai";
import { topLearnings } from "@/lib/learnings";
import { assetUrl } from "@/lib/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Campagnes + taux d'ouverture/clic uniques. */
export async function GET() {
  const campaigns = await prisma.emailCampaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const stats = await prisma.emailEvent.groupBy({
    by: ["campaignId", "type"],
    _count: { _all: true },
  });
  const byId: Record<string, { open: number; click: number }> = {};
  for (const s of stats) {
    byId[s.campaignId] ??= { open: 0, click: 0 };
    if (s.type === "open") byId[s.campaignId].open = s._count._all;
    if (s.type === "click") byId[s.campaignId].click = s._count._all;
  }
  return NextResponse.json(
    campaigns.map((c) => ({ ...c, opens: byId[c.id]?.open ?? 0, clicks: byId[c.id]?.click ?? 0 }))
  );
}

/** Génère une campagne (brouillon) avec Claude. Body : { brief? } */
export async function POST(req: NextRequest) {
  if (!aiEnabled()) {
    return NextResponse.json(
      { error: "IA non configurée : ajoutez ANTHROPIC_API_KEY puis redéployez." },
      { status: 503 }
    );
  }
  const body = (await req.json().catch(() => ({}))) as { brief?: string };
  const origin = process.env.APP_BASE_URL || req.nextUrl.origin;
  const [recent, learnings, asset] = await Promise.all([
    prisma.emailCampaign.findMany({ select: { subject: true }, orderBy: { createdAt: "desc" }, take: 8 }),
    topLearnings(),
    prisma.qrCode.findFirst({ orderBy: { createdAt: "asc" } }),
  ]);
  try {
    const g = await generateEmailCampaign({
      brief: body.brief?.trim() || undefined,
      recentSubjects: recent.map((r) => r.subject),
      learnings,
    });
    const campaign = await prisma.emailCampaign.create({
      data: {
        subject: g.subject,
        preheader: g.preheader,
        aiGenerated: true,
        content: JSON.stringify({
          intro: g.intro,
          sections: g.sections,
          ctaLabel: g.ctaLabel,
          ctaUrl: `${assetUrl(origin, asset)}?utm_source=email`,
        }),
      },
    });
    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    console.error("Erreur campagne e-mail :", err);
    return NextResponse.json({ error: "La génération a échoué." }, { status: 502 });
  }
}
