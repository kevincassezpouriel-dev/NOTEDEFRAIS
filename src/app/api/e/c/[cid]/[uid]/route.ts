import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Clic tracké puis redirection vers la vraie destination. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cid: string; uid: string }> }
) {
  const { cid, uid } = await params;
  await Promise.allSettled([
    prisma.emailEvent.create({ data: { campaignId: cid, contactId: uid, type: "click" } }),
    prisma.emailEvent.create({ data: { campaignId: cid, contactId: uid, type: "open" } }),
  ]);
  const to = req.nextUrl.searchParams.get("to") || "/";
  const safe = /^https?:\/\//.test(to) ? to : new URL(to.startsWith("/") ? to : "/", req.nextUrl.origin).toString();
  return NextResponse.redirect(safe, 302);
}
