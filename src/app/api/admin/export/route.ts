import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const HEADERS = [
  "date",
  "qr_nom",
  "qr_slug",
  "appareil",
  "os",
  "navigateur",
  "langue",
  "pays",
  "code_pays",
  "ville",
  "ip_anonymisee",
  "source",
  "redirection",
];

/** Export CSV des scans : /api/admin/export?qr={id}&days={n} */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const qrId = sp.get("qr") || undefined;
  const days = Number(sp.get("days"));

  const scans = await prisma.scanEvent.findMany({
    where: {
      ...(qrId ? { qrCodeId: qrId } : {}),
      ...(Number.isFinite(days) && days > 0
        ? { createdAt: { gte: new Date(Date.now() - days * 86_400_000) } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200_000,
    include: { qrCode: { select: { name: true, slug: true } } },
  });

  const rows = scans.map((s) =>
    [
      s.createdAt.toISOString(),
      s.qrCode.name,
      s.qrCode.slug,
      s.deviceType,
      s.os ?? "",
      s.browser ?? "",
      s.language ?? "",
      s.country ?? "",
      s.countryCode ?? "",
      s.city ?? "",
      s.ipAnonymized ?? "",
      s.referrer ?? "",
      s.redirectedTo,
    ]
      .map(csvEscape)
      .join(";")
  );

  // BOM UTF-8 + séparateur ";" : ouverture directe dans Excel français
  const csv = "\ufeff" + [HEADERS.join(";"), ...rows].join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="scans-${stamp}.csv"`,
    },
  });
}

function csvEscape(value: string): string {
  if (/[";\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
