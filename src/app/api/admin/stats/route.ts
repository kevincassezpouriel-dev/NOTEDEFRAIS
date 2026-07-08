import { NextRequest, NextResponse } from "next/server";
import { computeStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const days = Math.min(Math.max(Number(sp.get("days")) || 30, 1), 365);
  const qrId = sp.get("qr") || undefined;
  return NextResponse.json(await computeStats(qrId, days));
}
