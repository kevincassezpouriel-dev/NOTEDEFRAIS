import { NextRequest, NextResponse } from "next/server";
import { sendCampaign } from "@/lib/emailing";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Envoie la campagne à tous les contacts abonnés. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { segmentId?: string };
  const origin = process.env.APP_BASE_URL || req.nextUrl.origin;
  try {
    const sent = await sendCampaign(id, origin, body.segmentId || null);
    return NextResponse.json({ sent });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Envoi impossible" },
      { status: 400 }
    );
  }
}
