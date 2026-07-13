import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aiEnabled, inspireVisual } from "@/lib/ai";
import { parseVisual } from "@/lib/visual";
import type { Template, BgStyle, Motif } from "@/lib/visual";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

/**
 * Inspiration par image : { postId, image (data-URL) } → Claude (vision)
 * traduit la référence dans notre système et met à jour le visuel du post
 * (les slides, l'image de fond et la graine existantes sont conservées).
 */
export async function POST(req: NextRequest) {
  if (!aiEnabled()) {
    return NextResponse.json(
      { error: "IA non configurée : ajoutez ANTHROPIC_API_KEY puis redéployez." },
      { status: 503 }
    );
  }
  const body = (await req.json().catch(() => ({}))) as { postId?: string; image?: string };
  if (!body.postId || !body.image) {
    return NextResponse.json({ error: "postId et image requis" }, { status: 400 });
  }
  if (body.image.length > MAX_IMAGE_BYTES * 1.4) {
    return NextResponse.json({ error: "Image trop volumineuse (max 3 Mo)" }, { status: 400 });
  }
  const post = await prisma.post.findUnique({ where: { id: body.postId } });
  if (!post) return NextResponse.json({ error: "Post introuvable" }, { status: 404 });

  try {
    const result = await inspireVisual(body.image, { title: post.title, excerpt: post.excerpt });
    const current = parseVisual(post.visual, post.title, post.slug);
    const next = {
      ...current,
      template: result.template as Template,
      headline: result.headline,
      subline: result.subline,
      accentIndex: result.accentIndex,
      bg: result.bg as BgStyle,
      motif: result.motif as Motif,
      mode: result.mode === "clair" ? ("clair" as const) : ("sombre" as const),
    };
    const updated = await prisma.post.update({
      where: { id: post.id },
      data: { visual: JSON.stringify(next) },
    });
    return NextResponse.json({ post: updated, rationale: result.rationale });
  } catch (err) {
    console.error("Erreur d'inspiration par image :", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "L'analyse de l'image a échoué." },
      { status: 502 }
    );
  }
}
