import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Suivi de conversion post-installation (endpoint public, aucune donnée
 * personnelle). L'application mobile appelle au premier lancement :
 *   GET /api/convert?qr={slug}&platform=ios|android
 * Voir README, section « Suivi des conversions ».
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("qr");
  const platform = req.nextUrl.searchParams.get("platform");
  // source = utm_source transmis par l'app (Install Referrer Android) →
  // attribution de l'installation à un post/canal précis.
  const source = req.nextUrl.searchParams.get("source");
  if (!slug) {
    return NextResponse.json({ error: "Paramètre qr manquant" }, { status: 400, headers: CORS });
  }
  const qr = await prisma.qrCode.findUnique({ where: { slug }, select: { id: true } });
  if (!qr) {
    return NextResponse.json({ error: "QR code inconnu" }, { status: 404, headers: CORS });
  }
  await prisma.conversion.create({
    data: {
      qrCodeId: qr.id,
      platform: platform === "ios" || platform === "android" ? platform : null,
      source: source?.slice(0, 100) || null,
    },
  });
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  return GET(req);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
