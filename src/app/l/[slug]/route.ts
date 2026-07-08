import { NextRequest } from "next/server";
import { handleScanRedirect } from "@/lib/redirect";

export const dynamic = "force-dynamic";

/**
 * Lien de suivi : même moteur que les QR codes (/r/{slug}) — détection
 * d'appareil, redirection intelligente, tracking anonymisé. À utiliser en
 * bio Instagram, stories, e-mails, etc.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  return handleScanRedirect(req, slug);
}
