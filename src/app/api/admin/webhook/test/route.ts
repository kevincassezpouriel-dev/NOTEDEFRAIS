import { NextRequest, NextResponse } from "next/server";
import { sendTestWebhook } from "@/lib/webhook";

export const dynamic = "force-dynamic";

/** Envoie un payload de test au webhook réseaux sociaux configuré. */
export async function POST(req: NextRequest) {
  const origin = process.env.APP_BASE_URL || req.nextUrl.origin;
  return NextResponse.json(await sendTestWebhook(origin));
}
