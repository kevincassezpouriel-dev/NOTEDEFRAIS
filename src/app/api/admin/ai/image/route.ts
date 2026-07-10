import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBrand } from "@/lib/brand";
import { parseVisual } from "@/lib/visual";
import { imageGenEnabled, buildImagePrompt, generateImage } from "@/lib/image";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Génère une VRAIE image de fond (IA) pour un post et la pose dans son visuel.
 * Body : { postId, angle? }. Nécessite IMAGE_API_KEY (voir src/lib/image.ts).
 */
export async function POST(req: NextRequest) {
  if (!imageGenEnabled()) {
    return NextResponse.json(
      {
        error:
          "Génération d'images non configurée : ajoutez IMAGE_API_KEY (fournisseur d'images compatible OpenAI Images) puis redéployez. Sans clé, utilisez l'upload de photo ou les fonds graphiques générés.",
      },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { postId?: string; angle?: string };
  if (!body.postId) return NextResponse.json({ error: "postId manquant" }, { status: 400 });

  const post = await prisma.post.findUnique({ where: { id: body.postId } });
  if (!post) return NextResponse.json({ error: "Post introuvable" }, { status: 404 });

  const brand = await getBrand();
  const visual = parseVisual(post.visual, post.title, post.slug);
  const prompt = buildImagePrompt(brand, {
    headline: visual.headline,
    angle: body.angle?.trim() || post.excerpt || undefined,
  });

  try {
    const dataUrl = await generateImage(prompt);
    if (!dataUrl) {
      return NextResponse.json({ error: "Aucune image renvoyée." }, { status: 502 });
    }
    const nextVisual = { ...visual, bgImage: dataUrl };
    const updated = await prisma.post.update({
      where: { id: post.id },
      data: { visual: JSON.stringify(nextVisual) },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("Erreur de génération d'image :", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "La génération d'image a échoué." },
      { status: 502 }
    );
  }
}
