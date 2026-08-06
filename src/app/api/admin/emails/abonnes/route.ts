import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { importContacts } from "@/lib/emailing";

export const dynamic = "force-dynamic";

/** Liste + stats des contacts. */
export async function GET() {
  const [subscribed, unsubscribed, recent] = await Promise.all([
    prisma.abonne.count({ where: { subscribed: true } }),
    prisma.abonne.count({ where: { subscribed: false } }),
    prisma.abonne.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { email: true, name: true, source: true, subscribed: true, createdAt: true },
    }),
  ]);
  return NextResponse.json({ subscribed, unsubscribed, recent });
}

/** Import en masse : { raw: "texte ou CSV contenant des e-mails" } */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { raw?: string };
  if (!body.raw?.trim()) return NextResponse.json({ error: "Aucun contenu" }, { status: 400 });
  const count = await importContacts(body.raw);
  return NextResponse.json({ imported: count });
}
