import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Endpoint PUBLIC branché sur votre app : à chaque inscription, POSTez
 * { email, name? } ici (+ en-tête x-api-key si CONTACTS_API_KEY est définie).
 */
export async function POST(req: NextRequest) {
  const expected = process.env.CONTACTS_API_KEY;
  if (expected && req.headers.get("x-api-key") !== expected) {
    return NextResponse.json({ error: "Clé invalide" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { email?: string; name?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) {
    return NextResponse.json({ error: "E-mail invalide" }, { status: 400 });
  }
  await prisma.contact.upsert({
    where: { email },
    create: { email, name: body.name?.slice(0, 80) ?? null, source: "app" },
    update: { subscribed: true, unsubscribedAt: null },
  });
  return NextResponse.json({ ok: true });
}
