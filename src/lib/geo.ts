import { isPrivateIp } from "./ip";

export interface GeoInfo {
  country: string | null;
  countryCode: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

const EMPTY: GeoInfo = {
  country: null,
  countryCode: null,
  city: null,
  latitude: null,
  longitude: null,
};

/**
 * Géolocalisation approximative (ville / pays), en trois niveaux :
 *   1. En-têtes Vercel  (x-vercel-ip-*)          — gratuit, aucune requête
 *   2. En-têtes Cloudflare (cf-ipcountry)        — gratuit, aucune requête
 *   3. ip-api.com (45 req/min gratuites)         — désactivable via GEOIP_DISABLED=1
 * La redirection du scan n'attend jamais cette fonction : elle est appelée
 * après l'envoi de la réponse (next/server `after`).
 * Latitude/longitude sont arrondies à 1 décimale (~11 km) : précision ville,
 * jamais individu (RGPD).
 */
export async function geolocate(headers: Headers, ip: string | null): Promise<GeoInfo> {
  // 1) Vercel
  const vercelCountry = headers.get("x-vercel-ip-country");
  if (vercelCountry) {
    const city = headers.get("x-vercel-ip-city");
    return {
      country: countryName(vercelCountry),
      countryCode: vercelCountry,
      city: city ? safeDecode(city) : null,
      latitude: roundCoord(headers.get("x-vercel-ip-latitude")),
      longitude: roundCoord(headers.get("x-vercel-ip-longitude")),
    };
  }

  // 2) Cloudflare
  const cfCountry = headers.get("cf-ipcountry");
  if (cfCountry && cfCountry !== "XX" && cfCountry !== "T1") {
    return { ...EMPTY, country: countryName(cfCountry), countryCode: cfCountry };
  }

  // 3) ip-api.com
  if (process.env.GEOIP_DISABLED === "1") return EMPTY;
  if (!ip || isPrivateIp(ip)) return EMPTY;
  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,city,lat,lon`,
      { signal: AbortSignal.timeout(2000), cache: "no-store" }
    );
    if (!res.ok) return EMPTY;
    const data = (await res.json()) as {
      status: string;
      country?: string;
      countryCode?: string;
      city?: string;
      lat?: number;
      lon?: number;
    };
    if (data.status !== "success") return EMPTY;
    return {
      country: data.country ?? null,
      countryCode: data.countryCode ?? null,
      city: data.city ?? null,
      latitude: typeof data.lat === "number" ? Math.round(data.lat * 10) / 10 : null,
      longitude: typeof data.lon === "number" ? Math.round(data.lon * 10) / 10 : null,
    };
  } catch {
    return EMPTY;
  }
}

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["fr"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function roundCoord(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
