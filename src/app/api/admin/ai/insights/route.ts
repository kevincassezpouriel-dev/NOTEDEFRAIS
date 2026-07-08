import { NextRequest, NextResponse } from "next/server";
import { aiEnabled, analyzeAudience } from "@/lib/ai";
import { computeStats, statsSummaryForAi } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Analyse IA de l'audience : GET /api/admin/ai/insights?days=30 */
export async function GET(req: NextRequest) {
  if (!aiEnabled()) {
    return NextResponse.json(
      {
        error:
          "IA non configurée : ajoutez la variable d'environnement ANTHROPIC_API_KEY (clé sur console.anthropic.com) puis redéployez.",
      },
      { status: 503 }
    );
  }

  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days")) || 30, 1), 365);
  const stats = await computeStats(undefined, days);

  if (stats.period === 0) {
    return NextResponse.json({
      analysis:
        "Aucun scan sur la période : il n'y a pas encore de données à analyser. Imprimez vos QR codes, partagez vos liens de suivi, et revenez quand les premiers scans seront enregistrés.",
      days,
    });
  }

  try {
    const analysis = await analyzeAudience(statsSummaryForAi(stats), days);
    return NextResponse.json({ analysis, days });
  } catch (err) {
    console.error("Erreur d'analyse IA :", err);
    return NextResponse.json(
      { error: "L'analyse a échoué. Vérifiez la clé API et réessayez." },
      { status: 502 }
    );
  }
}
