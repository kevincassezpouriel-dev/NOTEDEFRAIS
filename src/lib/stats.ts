import { prisma } from "./prisma";
import { dayKey, lastDayKeys } from "./dates";

const MAX_EVENTS = 100_000;

export interface StatsResult {
  total: number;
  today: number;
  last7: number;
  period: number;
  days: number;
  totalConversions: number;
  byDay: { date: string; total: number; ios: number; android: number; other: number }[];
  devices: Record<string, number>;
  redirects: Record<string, number>;
  browsers: Record<string, number>;
  referrers: { referrer: string; count: number }[];
  countries: { country: string; countryCode: string | null; count: number }[];
  cities: {
    city: string;
    country: string | null;
    latitude: number | null;
    longitude: number | null;
    count: number;
  }[];
  perQr: {
    id: string;
    name: string;
    slug: string;
    type: string;
    channel: string | null;
    active: boolean;
    total: number;
    conversions: number;
    period: number;
    today: number;
    last7: number;
  }[];
}

/** Agrège les statistiques de scans (tous QR/liens ou un seul). */
export async function computeStats(qrId: string | undefined, days: number): Promise<StatsResult> {
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
        browser: true,
        referrer: true,
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
        type: true,
        channel: true,
        active: true,
        _count: { select: { scans: true, conversions: true } },
      },
    }),
  ]);

  const todayKey = dayKey(new Date());
  const last7Since = Date.now() - 7 * 86_400_000;

  const byDay = new Map<string, { total: number; ios: number; android: number; other: number }>();
  for (const key of lastDayKeys(days)) byDay.set(key, { total: 0, ios: 0, android: 0, other: 0 });
  const devices: Record<string, number> = {};
  const redirects: Record<string, number> = {};
  const browsers: Record<string, number> = {};
  const referrers = new Map<string, number>();
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
    if (e.browser) browsers[e.browser] = (browsers[e.browser] ?? 0) + 1;
    if (e.referrer) referrers.set(e.referrer, (referrers.get(e.referrer) ?? 0) + 1);

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

  return {
    total,
    today,
    last7,
    period: events.length,
    days,
    totalConversions,
    byDay: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
    devices,
    redirects,
    browsers,
    referrers: [...referrers.entries()]
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
    countries: [...countries.values()].sort((a, b) => b.count - a.count).slice(0, 30),
    cities: [...cities.values()].sort((a, b) => b.count - a.count).slice(0, 100),
    perQr: qrcodes.map((qr) => ({
      id: qr.id,
      name: qr.name,
      slug: qr.slug,
      type: qr.type,
      channel: qr.channel,
      active: qr.active,
      total: qr._count.scans,
      conversions: qr._count.conversions,
      period: perQrPeriod.get(qr.id)?.period ?? 0,
      today: perQrPeriod.get(qr.id)?.today ?? 0,
      last7: perQrPeriod.get(qr.id)?.last7 ?? 0,
    })),
  };
}

/** Résumé compact des stats pour les prompts IA (limite le volume de tokens). */
export function statsSummaryForAi(stats: StatsResult): string {
  return JSON.stringify(
    {
      periode_jours: stats.days,
      scans_total: stats.total,
      scans_periode: stats.period,
      scans_aujourdhui: stats.today,
      conversions_total: stats.totalConversions,
      par_jour: stats.byDay.filter((d) => d.total > 0),
      appareils: stats.devices,
      destinations: stats.redirects,
      navigateurs: stats.browsers,
      sources_trafic: stats.referrers,
      pays: stats.countries.slice(0, 10),
      villes: stats.cities.slice(0, 10).map(({ city, country, count }) => ({ city, country, count })),
      campagnes: stats.perQr.map((q) => ({
        nom: q.name,
        type: q.type,
        canal: q.channel,
        scans_periode: q.period,
        scans_total: q.total,
        conversions: q.conversions,
      })),
    },
    null,
    1
  );
}
