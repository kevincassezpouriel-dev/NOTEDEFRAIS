import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeStats } from "@/lib/stats";
import { postPerformance } from "@/lib/attribution";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Vue complète d'une campagne : objectif, assets, posts (avec attribution),
 *  timeline d'actions, apprentissages et statistiques agrégées. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      assets: {
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { scans: true, conversions: true } } },
      },
      posts: { orderBy: { createdAt: "desc" } },
      actions: { orderBy: { createdAt: "desc" }, take: 50 },
      learnings: { where: { active: true }, orderBy: [{ weight: "desc" }, { createdAt: "desc" }] },
    },
  });
  if (!campaign) return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });

  const perf = await postPerformance(
    campaign.posts.map((p) => p.utmSource ?? "").filter(Boolean)
  );

  const assetIds = new Set(campaign.assets.map((a) => a.id));
  const stats = await computeStats(undefined, 90);
  const perQr = stats.perQr.filter((q) => assetIds.has(q.id));
  const aggregate = perQr.reduce(
    (acc, q) => ({
      total: acc.total + q.total,
      period: acc.period + q.period,
      conversions: acc.conversions + q.conversions,
    }),
    { total: 0, period: 0, conversions: 0 }
  );

  return NextResponse.json({
    ...campaign,
    assets: campaign.assets.map(({ _count, logo, ...a }) => ({
      ...a,
      hasLogo: Boolean(logo),
      totalScans: _count.scans,
      totalConversions: _count.conversions,
    })),
    posts: campaign.posts.map((p) => ({
      ...p,
      clicks: p.utmSource ? perf.get(p.utmSource)?.clicks ?? 0 : 0,
      installs: p.utmSource ? perf.get(p.utmSource)?.installs ?? 0 : 0,
    })),
    aggregate,
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    objective?: string | null;
    status?: "active" | "paused" | "archived";
  } | null;
  if (!body) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  try {
    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.objective !== undefined ? { objective: body.objective?.trim() || null } : {}),
        ...(body.status !== undefined
          ? { status: body.status, archivedAt: body.status === "archived" ? new Date() : null }
          : {}),
      },
    });
    return NextResponse.json(campaign);
  } catch {
    return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    // Les assets et posts sont conservés (campaignId passe à null)
    await prisma.campaign.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
  }
}
