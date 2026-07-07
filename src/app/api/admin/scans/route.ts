import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Derniers scans (pour la table « temps réel », interrogée toutes les 5 s). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 25, 1), 100);
  const qrId = sp.get("qr") || undefined;

  const scans = await prisma.scanEvent.findMany({
    where: qrId ? { qrCodeId: qrId } : {},
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { qrCode: { select: { name: true, slug: true } } },
  });

  return NextResponse.json(
    scans.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      qrName: s.qrCode.name,
      qrSlug: s.qrCode.slug,
      deviceType: s.deviceType,
      os: s.os,
      browser: s.browser,
      language: s.language,
      country: s.country,
      city: s.city,
      referrer: s.referrer,
      redirectedTo: s.redirectedTo,
    }))
  );
}
