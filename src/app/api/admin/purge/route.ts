import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Suppression de données (RGPD, art. 17) :
 *   { "mode": "all" }                      → tous les scans (+ conversions)
 *   { "mode": "olderThan", "days": 90 }    → scans plus vieux que N jours
 *   { "qrId": "..." }                      → limiter à un QR code
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    mode?: "all" | "olderThan";
    days?: number;
    qrId?: string;
  } | null;
  if (!body?.mode) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  const qrFilter = body.qrId ? { qrCodeId: body.qrId } : {};

  if (body.mode === "all") {
    const [scans, conversions] = await prisma.$transaction([
      prisma.scanEvent.deleteMany({ where: qrFilter }),
      prisma.conversion.deleteMany({ where: qrFilter }),
    ]);
    return NextResponse.json({ deletedScans: scans.count, deletedConversions: conversions.count });
  }

  const days = Number(body.days);
  if (!Number.isFinite(days) || days < 1) {
    return NextResponse.json({ error: "Nombre de jours invalide" }, { status: 400 });
  }
  const limit = new Date(Date.now() - days * 86_400_000);
  const scans = await prisma.scanEvent.deleteMany({
    where: { ...qrFilter, createdAt: { lt: limit } },
  });
  return NextResponse.json({ deletedScans: scans.count, deletedConversions: 0 });
}
