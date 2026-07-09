import { NextRequest, NextResponse } from "next/server";
import { runMarketingCycle } from "@/lib/engine";
import { getSettings, setSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Lance un cycle d'autopilote à la demande depuis l'admin (test / cadence
 * manuelle). Respecte le mode configuré : si "off", force un cycle en mode
 * "draft" pour ne rien publier sans validation.
 */
export async function POST(req: NextRequest) {
  const settings = await getSettings();
  if (settings.autopilotMode === "off") {
    // Forcer temporairement le mode brouillon pour un lancement manuel sûr
    await setSettings({ autopilotMode: "draft" });
    const result = await runMarketingCycle(req.nextUrl.origin);
    await setSettings({ autopilotMode: "off" });
    return NextResponse.json(result);
  }
  const result = await runMarketingCycle(req.nextUrl.origin);
  return NextResponse.json(result);
}
