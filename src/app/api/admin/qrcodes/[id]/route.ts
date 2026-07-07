import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateLogo, validateSlug, validateUrls } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const qr = await prisma.qrCode.findUnique({
    where: { id },
    include: { _count: { select: { scans: true, conversions: true } } },
  });
  if (!qr) return NextResponse.json({ error: "QR code introuvable" }, { status: 404 });
  const { _count, ...rest } = qr;
  return NextResponse.json({
    ...rest,
    totalScans: _count.scans,
    totalConversions: _count.conversions,
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    slug?: string;
    appStoreUrl?: string;
    playStoreUrl?: string;
    fallbackUrl?: string;
    logo?: string | null;
    active?: boolean;
  } | null;
  if (!body) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  const invalid = validateUrls(body) ?? validateLogo(body.logo);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  if (body.slug !== undefined) {
    const slug = body.slug.trim().toLowerCase();
    const slugError = validateSlug(slug);
    if (slugError) return NextResponse.json({ error: slugError }, { status: 400 });
    const other = await prisma.qrCode.findUnique({ where: { slug } });
    if (other && other.id !== id) {
      return NextResponse.json({ error: `Le slug « ${slug} » est déjà utilisé` }, { status: 409 });
    }
    body.slug = slug;
  }

  try {
    const qr = await prisma.qrCode.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.slug !== undefined ? { slug: body.slug } : {}),
        ...(body.appStoreUrl !== undefined ? { appStoreUrl: body.appStoreUrl.trim() } : {}),
        ...(body.playStoreUrl !== undefined ? { playStoreUrl: body.playStoreUrl.trim() } : {}),
        ...(body.fallbackUrl !== undefined ? { fallbackUrl: body.fallbackUrl.trim() } : {}),
        ...(body.logo !== undefined ? { logo: body.logo || null } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      },
    });
    return NextResponse.json(qr);
  } catch {
    return NextResponse.json({ error: "QR code introuvable" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    // Supprime aussi tous les scans et conversions associés (cascade)
    await prisma.qrCode.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "QR code introuvable" }, { status: 404 });
  }
}
