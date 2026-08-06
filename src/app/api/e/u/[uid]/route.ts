import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBrand } from "@/lib/brand";

export const dynamic = "force-dynamic";

/** Désinscription en un clic (RGPD) + page de confirmation sobre. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid } = await params;
  await prisma.abonne
    .update({ where: { id: uid }, data: { subscribed: false, unsubscribedAt: new Date() } })
    .catch(() => null);
  const brand = await getBrand();
  return new Response(
    `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Désinscription</title>
<body style="font-family:system-ui,sans-serif;background:#f4f4f6;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
<div style="background:#fff;border-radius:16px;padding:36px;max-width:420px;text-align:center">
<h1 style="font-size:20px;color:${brand.colorDark}">C'est noté 👋</h1>
<p style="color:#555;font-size:15px;line-height:1.6">Tu ne recevras plus nos e-mails. Tu peux te réinscrire à tout moment depuis l'app ${brand.name}.</p>
</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
