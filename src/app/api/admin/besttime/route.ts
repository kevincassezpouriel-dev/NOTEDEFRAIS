import { NextResponse } from "next/server";
import { bestTimes } from "@/lib/besttime";

export const dynamic = "force-dynamic";

/** Meilleurs créneaux de publication, calculés sur l'activité réelle. */
export async function GET() {
  return NextResponse.json(await bestTimes());
}
