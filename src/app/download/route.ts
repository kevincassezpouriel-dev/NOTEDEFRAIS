import { NextRequest } from "next/server";
import { handleScanRedirect } from "@/lib/redirect";

export const dynamic = "force-dynamic";

/** Alias historique : /download = le QR code par défaut (slug "download"). */
export async function GET(req: NextRequest) {
  return handleScanRedirect(req, "download");
}
