import type { Post } from "@prisma/client";

/**
 * Pont vers les réseaux sociaux : à la publication d'un post, on POST son
 * contenu vers SOCIAL_WEBHOOK_URL. Branchez-y un scénario Zapier, Make,
 * IFTTT ou Buffer qui republie automatiquement sur Instagram, Facebook,
 * LinkedIn, X… (voir README, section « Publication automatique »).
 * Aucune erreur ici ne bloque la publication sur le site.
 */
export async function notifySocialWebhook(post: Post, siteUrl: string): Promise<boolean> {
  const url = process.env.SOCIAL_WEBHOOK_URL;
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        event: "post.published",
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        hashtags: post.hashtags,
        url: `${siteUrl}/news/${post.slug}`,
        publishedAt: post.publishedAt,
        aiGenerated: post.aiGenerated,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("Webhook réseaux sociaux injoignable :", err);
    return false;
  }
}
