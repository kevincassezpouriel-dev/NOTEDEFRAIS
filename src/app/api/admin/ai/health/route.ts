import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Diagnostic (protégé par l'admin) : indique si la clé IA est bien vue par
 * le runtime, SANS jamais révéler la clé (seuls les 4 derniers caractères).
 * Sert à vérifier qu'un déploiement Vercel a bien la variable d'environnement.
 */
export async function GET() {
  const key = process.env.ANTHROPIC_API_KEY || "";
  return NextResponse.json({
    aiConfigured: Boolean(key),
    keyLength: key.length,
    keyTail: key ? `…${key.slice(-4)}` : null,
    keyLooksValid: key.startsWith("sk-ant-"),
    imageConfigured: Boolean(process.env.IMAGE_API_KEY),
    // Contexte de déploiement (renseigné automatiquement par Vercel) :
    // permet de confirmer QUEL déploiement/commit sert réellement le site.
    deployment: {
      env: process.env.VERCEL_ENV ?? null, // production | preview | development
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      builtAt: process.env.VERCEL_DEPLOYMENT_ID ? "vercel" : "inconnu",
    },
    now: new Date().toISOString(),
  });
}
