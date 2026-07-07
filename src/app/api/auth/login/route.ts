import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD n'est pas configuré sur le serveur" },
      { status: 500 }
    );
  }

  let password = "";
  try {
    const body = (await req.json()) as { password?: string };
    password = body.password ?? "";
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  // Comparaison à temps constant sur les empreintes SHA-256
  const a = createHash("sha256").update(password).digest();
  const b = createHash("sha256").update(expected).digest();
  if (!timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
  }

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
