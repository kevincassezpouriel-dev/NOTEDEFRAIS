import { NextRequest, NextResponse } from "next/server";
import { getBrand, setBrand, type BrandIdentity } from "@/lib/brand";

export const dynamic = "force-dynamic";

const MAX_LOGO_BYTES = 300 * 1024;

export async function GET() {
  return NextResponse.json(await getBrand());
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Partial<BrandIdentity> | null;
  if (!body) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  for (const key of ["colorPrimary", "colorSecondary", "colorDark"] as const) {
    const value = body[key];
    if (value !== undefined && !/^#[0-9a-fA-F]{6}$/.test(value)) {
      return NextResponse.json(
        { error: `Couleur invalide pour ${key} (format attendu : #RRGGBB)` },
        { status: 400 }
      );
    }
  }
  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json({ error: "Le nom de marque est obligatoire" }, { status: 400 });
  }
  if (
    body.typography !== undefined &&
    !["moderne", "impactful", "elegant", "technique"].includes(body.typography)
  ) {
    return NextResponse.json({ error: "Typographie invalide" }, { status: 400 });
  }
  if (body.logo != null && body.logo !== "") {
    if (!body.logo.startsWith("data:image/")) {
      return NextResponse.json({ error: "Le logo doit être une image" }, { status: 400 });
    }
    if (body.logo.length > MAX_LOGO_BYTES * 1.4) {
      return NextResponse.json({ error: "Logo trop volumineux (max 300 Ko)" }, { status: 400 });
    }
  }
  if (body.logo === "") body.logo = null;

  return NextResponse.json(await setBrand(body));
}
