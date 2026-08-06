import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { contactMatches, type SegmentRule } from "@/lib/emailing";

export const dynamic = "force-dynamic";

/** Listes ciblées + clés d'attributs détectées + effectifs. */
export async function GET() {
  const [segments, contacts] = await Promise.all([
    prisma.segment.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.abonne.findMany({
      where: { subscribed: true },
      select: { attributes: true },
    }),
  ]);
  // Clés de profil disponibles (issues du CSV importé)
  const keys = new Set<string>();
  for (const c of contacts.slice(0, 500)) {
    try {
      Object.keys(JSON.parse(c.attributes ?? "{}")).forEach((k) => keys.add(k));
    } catch {
      /* ignoré */
    }
  }
  const withCounts = segments.map((s) => {
    let rules: SegmentRule[] = [];
    try {
      rules = JSON.parse(s.rules) as SegmentRule[];
    } catch {
      /* ignoré */
    }
    return {
      ...s,
      count: contacts.filter((c) => contactMatches(c.attributes, rules)).length,
    };
  });
  return NextResponse.json({
    segments: withCounts,
    attributeKeys: [...keys].sort(),
    total: contacts.length,
  });
}

/** Crée une liste : { name, rules: [{key, op, value}] } */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    rules?: SegmentRule[];
  };
  if (!body.name?.trim() || !Array.isArray(body.rules) || body.rules.length === 0) {
    return NextResponse.json({ error: "Nom et au moins une règle requis" }, { status: 400 });
  }
  const rules = body.rules
    .filter((r) => r && r.key && r.value !== undefined)
    .slice(0, 5)
    .map((r) => ({
      key: String(r.key).slice(0, 60),
      op: ["contient", "egal", "min", "max"].includes(r.op) ? r.op : "contient",
      value: String(r.value).slice(0, 120),
    }));
  const segment = await prisma.segment.create({
    data: { name: body.name.trim().slice(0, 80), rules: JSON.stringify(rules) },
  });
  return NextResponse.json(segment, { status: 201 });
}
