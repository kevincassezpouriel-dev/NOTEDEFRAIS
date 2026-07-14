import { NextRequest, NextResponse } from "next/server";
import { aiEnabled, extractBrandDna } from "@/lib/ai";
import { logAction } from "@/lib/actions";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** ADN de marque depuis un site (méthode Pomelli) : { url } */
export async function POST(req: NextRequest) {
  if (!aiEnabled()) {
    return NextResponse.json(
      { error: "IA non configurée : ajoutez ANTHROPIC_API_KEY puis redéployez." },
      { status: 503 }
    );
  }
  const body = (await req.json().catch(() => ({}))) as { url?: string };
  const url = body.url?.trim();
  if (!url || !/^https?:\/\/.+\..+/.test(url)) {
    return NextResponse.json({ error: "URL de site invalide" }, { status: 400 });
  }
  try {
    const dna = await extractBrandDna(url.slice(0, 300));
    await logAction({
      type: "analysis.run",
      actor: "ai",
      title: `ADN de marque extrait de ${url}`,
      detail: dna.rationale.slice(0, 500),
      status: "done",
    });
    return NextResponse.json(dna);
  } catch (err) {
    console.error("Erreur d'extraction d'ADN :", err);
    return NextResponse.json(
      { error: "L'analyse du site a échoué (site inaccessible ? réessayez)." },
      { status: 502 }
    );
  }
}
