import { NextRequest, NextResponse } from "next/server";
import { getSettings, setSettings, type AutopilotMode } from "@/lib/settings";
import { aiEnabled } from "@/lib/ai";
import { emailEnabled } from "@/lib/email";
import { getSocialConfig, setSocialConfig } from "@/lib/webhook";

export const dynamic = "force-dynamic";

export async function GET() {
  const [settings, social] = await Promise.all([getSettings(), getSocialConfig()]);
  return NextResponse.json({
    ...settings,
    socialWebhookUrl: social.url,
    socialNetworks: social.networks,
    aiEnabled: aiEnabled(),
    emailEnabled: emailEnabled(),
    webhookEnabled: Boolean(social.url),
  });
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    autopilotMode?: AutopilotMode;
    reportEmail?: string;
    monthlyBudgetEur?: number;
    socialWebhookUrl?: string;
    socialNetworks?: string[];
  } | null;
  if (!body) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  if (
    body.autopilotMode !== undefined &&
    !["off", "draft", "auto"].includes(body.autopilotMode)
  ) {
    return NextResponse.json({ error: "Mode invalide" }, { status: 400 });
  }
  if (
    body.socialWebhookUrl !== undefined &&
    body.socialWebhookUrl.trim() !== "" &&
    !/^https?:\/\//i.test(body.socialWebhookUrl.trim())
  ) {
    return NextResponse.json({ error: "L'URL du webhook doit commencer par https://" }, { status: 400 });
  }

  await setSettings({
    ...(body.autopilotMode !== undefined ? { autopilotMode: body.autopilotMode } : {}),
    ...(body.reportEmail !== undefined ? { reportEmail: body.reportEmail.trim() } : {}),
    ...(body.monthlyBudgetEur !== undefined
      ? { monthlyBudgetEur: Math.max(0, Number(body.monthlyBudgetEur) || 0) }
      : {}),
  });
  await setSocialConfig({
    ...(body.socialWebhookUrl !== undefined ? { url: body.socialWebhookUrl } : {}),
    ...(body.socialNetworks !== undefined ? { networks: body.socialNetworks } : {}),
  });

  const [settings, social] = await Promise.all([getSettings(), getSocialConfig()]);
  return NextResponse.json({
    ...settings,
    socialWebhookUrl: social.url,
    socialNetworks: social.networks,
    webhookEnabled: Boolean(social.url),
  });
}
