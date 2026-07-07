import { NextRequest } from "next/server";
import { handleScanRedirect } from "@/lib/redirect";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  return handleScanRedirect(req, slug);
}
