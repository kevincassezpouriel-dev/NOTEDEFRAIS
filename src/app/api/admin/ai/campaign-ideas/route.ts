import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aiEnabled, generateCampaignIdeas } from "@/lib/ai";
import { computeStats, statsSummaryForAi } from "@/lib/stats";
import { topLearnings } from "@/lib/learnings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Idées de campagnes (méthode Pomelli, étape 2). */
export async function POST() {
  if (!aiEnabled()) {
    return NextResponse.json(
      { error: "IA non configurée : ajoutez ANTHROPIC_API_KEY puis redéployez." },
      { status: 503 }
    );
  }
  try {
    const [stats, learnings, campaigns] = await Promise.all([
      computeStats(undefined, 30).then(statsSummaryForAi),
      topLearnings(),
      prisma.campaign.findMany({ select: { name: true }, take: 20 }),
    ]);
    const ideas = await generateCampaignIdeas({
      statsSummary: stats,
      learnings,
      existingCampaigns: campaigns.map((c) => c.name),
    });
    return NextResponse.json({ ideas });
  } catch (err) {
    console.error("Erreur d'idées de campagnes :", err);
    return NextResponse.json({ error: "La génération d'idées a échoué." }, { status: 502 });
  }
}
