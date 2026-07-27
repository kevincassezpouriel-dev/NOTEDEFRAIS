import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBrand } from "@/lib/brand";
import { parseCampaignContent, renderCampaignHtml } from "@/lib/emailing";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ id: string }> };

/** ?format=html → aperçu HTML rendu (sans tracking). Sinon JSON. */
export async function GET(req: NextRequest, { params }: P) {
  const { id } = await params;
  const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (req.nextUrl.searchParams.get("format") === "html") {
    const brand = await getBrand();
    const html = renderCampaignHtml({
      brand,
      campaignId: campaign.id,
      subject: campaign.subject,
      preheader: campaign.preheader,
      content: parseCampaignContent(campaign.content),
      origin: process.env.APP_BASE_URL || req.nextUrl.origin,
    });
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  return NextResponse.json(campaign);
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const { id } = await params;
  try {
    await prisma.emailCampaign.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
}
