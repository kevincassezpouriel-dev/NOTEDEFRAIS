import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dayKey, lastDayKeys } from "@/lib/dates";

export const dynamic = "force-dynamic";

const MAX_EVENTS = 100_000;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const days = Math.min(Math.max(Number(sp.get("days")) || 30, 1), 365);
  const qrId = sp.get("qr") || undefined;

  const scanWhere = qrId ? { qrCodeId: qrId } : {};
  const since = new Date(Date.now() - days * 86_400_000);

  const [total, totalConversions, events, qrcodes] = await Promise.all([
    prisma.scanEvent.count({ where: scanWhere }),
    prisma.conversion.count({ where: qrId ? { qrCodeId: qrId } : {} }),
    prisma.scanEvent.findMany({
      where: { ...scanWhere, createdAt: { gte: since } },
      select: {
        createdAt: true,
        qrCodeId: true,
        deviceType: true,
        country: true,
        countryCode: true,
        city: true,
        latitude: true,
        longitude: true,
        redirectedTo: true,
      },
      orderBy: { createdAt: "asc" },
      take: MAX_EVENTS,
    }),
    prisma.qrCode.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        active: true,
        _count: { select: { scans: true, conversions: true } },
      },
    }),
  ]);

  const todayKey = dayKey(new Date());
  const last7Since = Date.now() - 7 * 86_400_000;

  // Agrégations en un seul passage
  const byDay = new Map<string, { total: number; ios: number; android: number; other: number }>();
  for (const key of lastDayKeys(days)) byDay.set(key, { total: 0, ios: 0, android: 0, other: 0 });
  const devices: Record<string, number> = {};
  const redirects: Record<string, number> = {};
  const countries = new Map<string, { country: string; countryCode: string | null; count: number }>();
  const cities = new Map<
    string,
    { city: string; country: string | null; latitude: number | null; longitude: number | null; count: number }
  >();
  const perQrPeriod = new Map<string, { period: number; today: number; last7: number }>();
  let today = 0;
  let last7 = 0;

  for (const e of events) {
    const key = dayKey(e.createdAt);
    const day = byDay.get(key);
    if (day) {
      day.total++;
      if (e.deviceType === "iphone" || e.deviceType === "ipad") day.ios++;
      else if (e.deviceType === "android") day.android++;
      else day.other++;
    }
    if (key === todayKey) today++;
    if (e.createdAt.getTime() >= last7Since) last7++;

    devices[e.deviceType] = (devices[e.deviceType] ?? 0) + 1;
    redirects[e.redirectedTo] = (redirects[e.redirectedTo] ?? 0) + 1;

    if (e.country) {
      const c = countries.get(e.country) ?? {
        country: e.country,
        countryCode: e.countryCode,
        count: 0,
      };
      c.count++;
      countries.set(e.country, c);
    }
    if (e.city) {
      const cityKey = `${e.city}|${e.countryCode ?? ""}`;
      const c = cities.get(cityKey) ?? {
        city: e.city,
        country: e.country,
        latitude: e.latitude,
        longitude: e.longitude,
        count: 0,
      };
      c.count++;
      cities.set(cityKey, c);
    }

    const p = perQrPeriod.get(e.qrCodeId) ?? { period: 0, today: 0, last7: 0 };
    p.period++;
    if (key === todayKey) p.today++;
    if (e.createdAt.getTime() >= last7Since) p.last7++;
    perQrPeriod.set(e.qrCodeId, p);
  }

  return NextResponse.json({
    total,
    today,
    last7,
    period: events.length,
    days,
    totalConversions,
    byDay: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
    devices,
    redirects,
    countries: [...countries.values()].sort((a, b) => b.count - a.count).slice(0, 30),
    cities: [...cities.values()].sort((a, b) => b.count - a.count).slice(0, 100),
    perQr: qrcodes.map((qr) => ({
      id: qr.id,
      name: qr.name,
      slug: qr.slug,
      active: qr.active,
      total: qr._count.scans,
      conversions: qr._count.conversions,
      period: perQrPeriod.get(qr.id)?.period ?? 0,
      today: perQrPeriod.get(qr.id)?.today ?? 0,
      last7: perQrPeriod.get(qr.id)?.last7 ?? 0,
    })),
  });
}
