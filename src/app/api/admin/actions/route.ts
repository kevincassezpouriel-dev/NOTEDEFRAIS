import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Timeline globale d'activité (tous types d'actions confondus). */
export async function GET(req: NextRequest) {
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 40, 1), 200);
  const actions = await prisma.action.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { campaign: { select: { id: true, name: true } } },
  });
  return NextResponse.json(actions);
}
