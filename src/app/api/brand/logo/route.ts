import { NextResponse } from "next/server";
import { getBrand } from "@/lib/brand";

export const dynamic = "force-dynamic";

/** Sert le logo de marque en vraie image (les clients mail bloquent les data-URL). */
export async function GET() {
  const brand = await getBrand();
  const m = brand.logo?.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (!m) return new Response("Aucun logo", { status: 404 });
  return new NextResponse(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "public, max-age=3600" },
  });
}
