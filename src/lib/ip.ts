/**
 * Extraction et anonymisation d'adresses IP (RGPD).
 * L'IP complète n'est JAMAIS stockée : elle sert uniquement, en mémoire,
 * à la géolocalisation approximative, puis seule la forme anonymisée
 * est enregistrée.
 */

export function getClientIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return stripPort(first);
  }
  const real = headers.get("x-real-ip") ?? headers.get("cf-connecting-ip");
  return real ? stripPort(real.trim()) : null;
}

function stripPort(ip: string): string {
  // "1.2.3.4:5678" ou "[::1]:5678"
  if (ip.startsWith("[")) return ip.slice(1).split("]")[0];
  const v4WithPort = ip.match(/^(\d+\.\d+\.\d+\.\d+):\d+$/);
  return v4WithPort ? v4WithPort[1] : ip;
}

/** IPv4 : dernier octet mis à 0 — IPv6 : tronquée aux 3 premiers groupes (/48). */
export function anonymizeIp(ip: string | null): string | null {
  if (!ip) return null;
  const v4 = ip.match(/^(\d+\.\d+\.\d+)\.\d+$/);
  if (v4) return `${v4[1]}.0`;
  if (ip.includes(":")) {
    const groups = ip.split(":").filter(Boolean);
    return `${groups.slice(0, 3).join(":")}::`;
  }
  return null;
}

export function isPrivateIp(ip: string): boolean {
  return (
    /^(10\.|127\.|192\.168\.|169\.254\.)/.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    /^(::1|f[cd]|fe80)/i.test(ip)
  );
}
