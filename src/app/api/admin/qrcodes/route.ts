import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify, validateSlug, validateUrls } from "@/lib/validate";
import { logAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export async function GET() {
  const qrcodes = await prisma.qrCode.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { scans: true, conversions: true } },
    },
  });
  return NextResponse.json(
    qrcodes.map(({ _count, logo, ...qr }) => ({
      ...qr,
      hasLogo: Boolean(logo),
      totalScans: _count.scans,
      totalConversions: _count.conversions,
    }))
  );
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    slug?: string;
    type?: string;
    channel?: string;
    campaignId?: string;
    appStoreUrl?: string;
    playStoreUrl?: string;
    fallbackUrl?: string;
  } | null;

  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "Le nom est obligatoire" }, { status: 400 });
  }

  const slug = (body.slug?.trim() || slugify(body.name)).toLowerCase();
  const invalid = validateSlug(slug) ?? validateUrls(body);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const existing = await prisma.qrCode.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: `Le slug « ${slug} » est déjà utilisé` }, { status: 409 });
  }

  const qr = await prisma.qrCode.create({
    data: {
      name: body.name.trim(),
      slug,
      type: body.type === "link" ? "link" : "qr",
      channel: body.channel?.trim() || null,
      appStoreUrl: body.appStoreUrl?.trim() ?? "",
      playStoreUrl: body.playStoreUrl?.trim() ?? "",
      fallbackUrl: body.fallbackUrl?.trim() ?? "",
    },
  });
  await logAction({
    type: "asset.created",
    title: `${qr.type === "link" ? "Lien" : "QR code"} créé : « ${qr.name} »`,
    refType: "qr",
    refId: qr.id,
  });
  return NextResponse.json(qr, { status: 201 });
}
