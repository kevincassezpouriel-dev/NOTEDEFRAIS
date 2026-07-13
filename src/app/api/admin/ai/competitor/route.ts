import { NextRequest, NextResponse } from "next/server";
import { aiEnabled, analyzeCompetitor } from "@/lib/ai";
import { logAction } from "@/lib/actions";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Veille concurrentielle : { input: "url ou nom du concurrent" } */
export async function POST(req: NextRequest) {
  if (!aiEnabled()) {
    return NextResponse.json(
      { error: "IA non configurée : ajoutez ANTHROPIC_API_KEY puis redéployez." },
      { status: 503 }
    );
  }
  const body = (await req.json().catch(() => ({}))) as { input?: string };
  const input = body.input?.trim();
  if (!input) {
    return NextResponse.json({ error: "Indiquez une URL ou un nom de concurrent" }, { status: 400 });
  }

  try {
    const analysis = await analyzeCompetitor(input.slice(0, 300));
    await logAction({
      type: "analysis.run",
      actor: "ai",
      title: `Veille concurrentielle : ${analysis.competitor}`,
      detail: analysis.summary.slice(0, 500),
      status: "done",
    });
    return NextResponse.json(analysis);
  } catch (err) {
    console.error("Erreur de veille concurrentielle :", err);
    return NextResponse.json(
      { error: "L'analyse a échoué (réessayez, ou vérifiez que la recherche web est activée pour votre clé API)." },
      { status: 502 }
    );
  }
}
