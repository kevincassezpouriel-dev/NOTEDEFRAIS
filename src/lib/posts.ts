import type { Post } from "@prisma/client";
import { prisma } from "./prisma";
import { notifySocialWebhook } from "./webhook";

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

/** Publie un post (visible sur /news) et notifie le webhook réseaux sociaux. */
export async function publishPost(postId: string, siteUrl: string): Promise<Post> {
  const post = await prisma.post.update({
    where: { id: postId },
    data: { status: "published", publishedAt: new Date() },
  });
  await notifySocialWebhook(post, siteUrl);
  return post;
}
