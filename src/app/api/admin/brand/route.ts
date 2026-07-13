import { NextRequest, NextResponse } from "next/server";
import { getBrand, setBrand, type BrandIdentity } from "@/lib/brand";

export const dynamic = "force-dynamic";

const MAX_LOGO_BYTES = 600 * 1024;
const MAX_PALETTE = 12;
const MAX_ASSETS = 8;
const MAX_ASSET_BYTES = 500 * 1024;

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
  if (body.palette !== undefined) {
    if (!Array.isArray(body.palette) || body.palette.length > MAX_PALETTE) {
      return NextResponse.json(
        { error: `Palette invalide (max ${MAX_PALETTE} couleurs)` },
        { status: 400 }
      );
    }
    for (const c of body.palette) {
      if (typeof c !== "string" || !/^#[0-9a-fA-F]{6}$/.test(c)) {
        return NextResponse.json(
          { error: `Couleur de palette invalide : « ${c} » (format attendu : #RRGGBB)` },
          { status: 400 }
        );
      }
    }
    // normalise en minuscules + dédoublonne
    body.palette = Array.from(new Set(body.palette.map((c) => c.toLowerCase())));
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
      return NextResponse.json({ error: "Logo trop volumineux (max 600 Ko)" }, { status: 400 });
    }
  }
  if (body.logo === "") body.logo = null;

  if (body.assets !== undefined) {
    if (!Array.isArray(body.assets) || body.assets.length > MAX_ASSETS) {
      return NextResponse.json(
        { error: `Bibliothèque invalide (max ${MAX_ASSETS} images)` },
        { status: 400 }
      );
    }
    for (const a of body.assets) {
      if (!a || typeof a.name !== "string" || typeof a.data !== "string" ||
          !a.data.startsWith("data:image/")) {
        return NextResponse.json({ error: "Image de bibliothèque invalide" }, { status: 400 });
      }
      if (a.data.length > MAX_ASSET_BYTES * 1.4) {
        return NextResponse.json(
          { error: `« ${a.name} » est trop volumineuse (max 500 Ko)` },
          { status: 400 }
        );
      }
      a.name = a.name.slice(0, 60);
    }
  }

  return NextResponse.json(await setBrand(body));
}
