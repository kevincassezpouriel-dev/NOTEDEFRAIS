import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/** Pixel d'ouverture — 1 ouverture unique par contact/campagne. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cid: string; uid: string }> }
) {
  const { cid, uid } = await params;
  prisma.emailEvent
    .create({ data: { campaignId: cid, contactId: uid, type: "open" } })
    .catch(() => null); // doublon ou id inconnu : ignoré
  return new Response(GIF, {
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" },
  });
}
