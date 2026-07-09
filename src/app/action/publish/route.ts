import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyActionToken } from "@/lib/token";
import { publishPost } from "@/lib/posts";

export const dynamic = "force-dynamic";

/**
 * Publication 1-clic depuis l'e-mail de validation (jeton signé, sans
 * connexion admin). Affiche une page de confirmation minimale.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? undefined;
  const postId = await verifyActionToken(token, "publish");

  if (!postId) return html("Lien invalide ou expiré.", false);

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return html("Ce post n'existe plus.", false);
  if (post.status === "published") {
    return html(`« ${post.title} » est déjà publié.`, true, post.slug, req.nextUrl.origin);
  }

  const origin = process.env.APP_BASE_URL || req.nextUrl.origin;
  await publishPost(postId, origin);
  return html(`« ${post.title} » est publié 🎉`, true, post.slug, req.nextUrl.origin);
}

function html(message: string, ok: boolean, slug?: string, origin?: string): NextResponse {
  const link = ok && slug ? `<p><a href="${origin}/news/${slug}">Voir l'article →</a></p>` : "";
  return new NextResponse(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Publication</title></head>
    <body style="font-family:system-ui,sans-serif;background:#f9f9f7;color:#0b0b0b;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
    <div style="background:#fff;border:1px solid rgba(11,11,11,.1);border-radius:12px;padding:40px;max-width:440px;text-align:center">
      <div style="font-size:40px;margin-bottom:12px">${ok ? "✅" : "⚠️"}</div>
      <h1 style="font-size:20px">${message}</h1>
      ${link}
      <p style="margin-top:16px"><a href="${origin ?? ""}/admin/posts" style="color:#2a78d6">Aller à l'administration</a></p>
    </div></body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
