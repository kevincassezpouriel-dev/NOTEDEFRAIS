import type { Post } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Pont vers les réseaux sociaux : à la publication d'un post, on POST son
 * contenu + ses visuels de marque vers le webhook configuré (page Réglages,
 * ou variable SOCIAL_WEBHOOK_URL). Branchez-y un scénario Make, Zapier,
 * IFTTT ou Buffer qui republie automatiquement sur les réseaux cochés.
 * Aucune erreur ici ne bloque la publication sur le site.
 */

export async function getSocialConfig(): Promise<{ url: string; networks: string[] }> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ["socialWebhookUrl", "socialNetworks"] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    url: map.get("socialWebhookUrl") || process.env.SOCIAL_WEBHOOK_URL || "",
    networks: (map.get("socialNetworks") || "instagram,facebook,linkedin")
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean),
  };
}

export async function setSocialConfig(partial: {
  url?: string;
  networks?: string[];
}): Promise<void> {
  const entries: [string, string][] = [];
  if (partial.url !== undefined) entries.push(["socialWebhookUrl", partial.url.trim()]);
  if (partial.networks !== undefined) entries.push(["socialNetworks", partial.networks.join(",")]);
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
    )
  );
}

export function buildWebhookPayload(post: Post, siteUrl: string, networks: string[]) {
  const base = siteUrl.replace(/\/+$/, "");
  return {
    event: "post.published",
    title: post.title,
    excerpt: post.excerpt,
    content: post.content,
    hashtags: post.hashtags,
    url: `${base}/news/${post.slug}`,
    imageUrl: `${base}/api/og/${post.slug}`,
    imageSquareUrl: `${base}/api/og/${post.slug}?format=carre`,
    networks,
    publishedAt: post.publishedAt,
    aiGenerated: post.aiGenerated,
  };
}

export async function notifySocialWebhook(post: Post, siteUrl: string): Promise<boolean> {
  const { url, networks } = await getSocialConfig();
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify(buildWebhookPayload(post, siteUrl, networks)),
    });
    return res.ok;
  } catch (err) {
    console.error("Webhook réseaux sociaux injoignable :", err);
    return false;
  }
}

/** Envoi de test depuis l'admin (payload factice clairement identifié). */
export async function sendTestWebhook(siteUrl: string): Promise<{ ok: boolean; detail: string }> {
  const { url, networks } = await getSocialConfig();
  if (!url) return { ok: false, detail: "Aucune URL de webhook configurée." };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        event: "test",
        title: "Test de connexion — MINGGLE QR Platform",
        excerpt: "Si vous voyez ce message dans Make/Zapier, la connexion fonctionne.",
        url: siteUrl,
        networks,
        sentAt: new Date().toISOString(),
      }),
    });
    return res.ok
      ? { ok: true, detail: `Le webhook a répondu ${res.status}.` }
      : { ok: false, detail: `Le webhook a répondu ${res.status}.` };
  } catch {
    return { ok: false, detail: "Webhook injoignable (URL invalide ou service hors ligne)." };
  }
}
