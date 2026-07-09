import type { Post } from "@prisma/client";
import { prisma } from "./prisma";
import { notifySocialWebhook } from "./webhook";
import { postUtmSource } from "./attribution";
import { logAction } from "./actions";

/** Suffixe -2, -3… si le slug est déjà pris. */
export async function uniquePostSlug(base: string): Promise<string> {
  let slug = base || "post";
  for (let i = 2; i < 100; i++) {
    const existing = await prisma.post.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

export interface CreatePostInput {
  title: string;
  slug: string;
  content: string;
  excerpt?: string | null;
  hashtags?: string | null;
  qrCodeId?: string | null;
  campaignId?: string | null;
  aiGenerated?: boolean;
}

/** Crée un post en garantissant slug ET utm_source uniques (attribution). */
export async function createPost(input: CreatePostInput): Promise<Post> {
  const slug = await uniquePostSlug(input.slug);
  const post = await prisma.post.create({
    data: {
      title: input.title,
      slug,
      content: input.content,
      excerpt: input.excerpt ?? null,
      hashtags: input.hashtags ?? null,
      qrCodeId: input.qrCodeId ?? null,
      campaignId: input.campaignId ?? null,
      aiGenerated: input.aiGenerated ?? false,
      utmSource: postUtmSource(slug),
    },
  });
  await logAction({
    type: input.aiGenerated ? "post.generated" : "asset.created",
    actor: input.aiGenerated ? "ai" : "human",
    title: input.aiGenerated ? `Brouillon généré : « ${post.title} »` : `Post créé : « ${post.title} »`,
    campaignId: post.campaignId,
    refType: "post",
    refId: post.id,
    status: "done",
  });
  return post;
}

/** Publie un post (visible sur /news), notifie le webhook et journalise. */
export async function publishPost(postId: string, siteUrl: string): Promise<Post> {
  const post = await prisma.post.update({
    where: { id: postId },
    data: { status: "published", publishedAt: new Date(), scheduledAt: null },
  });
  const relayed = await notifySocialWebhook(post, siteUrl);
  await logAction({
    type: "post.published",
    actor: "human",
    title: `Post publié : « ${post.title} »`,
    detail: relayed ? "Relayé au webhook réseaux sociaux." : undefined,
    campaignId: post.campaignId,
    refType: "post",
    refId: post.id,
  });
  return post;
}
