import { NextRequest, NextResponse } from "next/server";
import { getSettings, setSettings, type AutopilotMode } from "@/lib/settings";
import { aiEnabled } from "@/lib/ai";
import { emailEnabled } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({
    ...settings,
    aiEnabled: aiEnabled(),
    emailEnabled: emailEnabled(),
    webhookEnabled: Boolean(process.env.SOCIAL_WEBHOOK_URL),
  });
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    autopilotMode?: AutopilotMode;
    reportEmail?: string;
    monthlyBudgetEur?: number;
  } | null;
  if (!body) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  if (
    body.autopilotMode !== undefined &&
    !["off", "draft", "auto"].includes(body.autopilotMode)
  ) {
    return NextResponse.json({ error: "Mode invalide" }, { status: 400 });
  }
  await setSettings({
    ...(body.autopilotMode !== undefined ? { autopilotMode: body.autopilotMode } : {}),
    ...(body.reportEmail !== undefined ? { reportEmail: body.reportEmail.trim() } : {}),
    ...(body.monthlyBudgetEur !== undefined
      ? { monthlyBudgetEur: Math.max(0, Number(body.monthlyBudgetEur) || 0) }
      : {}),
  });
  return NextResponse.json(await getSettings());
}
