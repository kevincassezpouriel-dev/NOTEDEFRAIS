import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { assets: true, posts: true } } },
  });
  return NextResponse.json(
    campaigns.map(({ _count, ...c }) => ({
      ...c,
      assetCount: _count.assets,
      postCount: _count.posts,
    }))
  );
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    objective?: string;
  } | null;
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "Le nom est obligatoire" }, { status: 400 });
  }
  const campaign = await prisma.campaign.create({
    data: { name: body.name.trim(), objective: body.objective?.trim() || null },
  });
  return NextResponse.json(campaign, { status: 201 });
}
