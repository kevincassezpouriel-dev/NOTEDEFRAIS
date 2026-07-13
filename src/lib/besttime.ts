import { prisma } from "./prisma";

/**
 * « Meilleure heure pour publier » (principe Buffer/Later) : analyse les
 * horodatages réels des scans/clics des 60 derniers jours et dégage les
 * créneaux (jour de semaine + heure, fuseau du tableau de bord) où l'audience
 * est la plus active. Tant que les données sont maigres, on renvoie des
 * créneaux par défaut adaptés à une audience jeune France (soirée + dimanche).
 */
const TZ = process.env.DASHBOARD_TZ || "Europe/Paris";
const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MIN_EVENTS = 30;

export interface BestSlot {
  weekday: number; // 0 = dimanche … 6 = samedi
  hour: number; // 0-23 (fuseau TZ)
  score: number; // nombre d'événements observés sur ce créneau
  label: string; // « mercredi 18 h »
  nextAt: string; // prochaine occurrence (ISO)
}

export interface BestTimes {
  slots: BestSlot[];
  basedOn: number; // nombre d'événements analysés
  estimated: boolean; // true = défauts (pas encore assez de données)
}

function tzParts(d: Date): { weekday: number; hour: number } {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ,
    weekday: "long",
    hour: "numeric",
    hour12: false,
  }).formatToParts(d);
  const dayName = parts.find((p) => p.type === "weekday")?.value ?? "lundi";
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "12", 10);
  return { weekday: Math.max(0, DAY_NAMES.indexOf(dayName)), hour: hour % 24 };
}

/** Prochaine occurrence (Date) d'un couple jour/heure dans le fuseau TZ. */
function nextOccurrence(weekday: number, hour: number): Date {
  const now = new Date();
  // Balaye heure par heure sur 8 jours : robuste aux DST sans arithmétique de fuseau.
  for (let i = 1; i <= 24 * 8; i++) {
    const cand = new Date(now.getTime() + i * 3600_000);
    cand.setMinutes(0, 0, 0);
    const p = tzParts(cand);
    if (p.weekday === weekday && p.hour === hour && cand.getTime() > now.getTime()) {
      return cand;
    }
  }
  return new Date(now.getTime() + 24 * 3600_000);
}

function slot(weekday: number, hour: number, score: number): BestSlot {
  return {
    weekday,
    hour,
    score,
    label: `${DAY_NAMES[weekday]} ${hour} h`,
    nextAt: nextOccurrence(weekday, hour).toISOString(),
  };
}

// Défauts « audience jeune, France » tant que les données manquent.
const DEFAULT_SLOTS: [number, number][] = [
  [3, 18], // mercredi 18 h
  [0, 20], // dimanche 20 h
  [4, 12], // jeudi 12 h
];

export async function bestTimes(): Promise<BestTimes> {
  const since = new Date(Date.now() - 60 * 24 * 3600_000);
  const events = await prisma.scanEvent.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true },
    take: 20_000,
  });

  if (events.length < MIN_EVENTS) {
    return {
      slots: DEFAULT_SLOTS.map(([d, h]) => slot(d, h, 0)),
      basedOn: events.length,
      estimated: true,
    };
  }

  const counts = new Map<string, number>();
  for (const e of events) {
    const { weekday, hour } = tzParts(e.createdAt);
    const key = `${weekday}-${hour}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const ranked = [...counts.entries()]
    .map(([key, n]) => {
      const [d, h] = key.split("-").map(Number);
      return { d, h, n };
    })
    .sort((a, b) => b.n - a.n);

  // Top 3 créneaux sur des jours distincts de préférence (plus actionnable
  // qu'un trio « mercredi 18/19/20 h »).
  const picked: { d: number; h: number; n: number }[] = [];
  for (const r of ranked) {
    if (picked.length >= 3) break;
    if (picked.some((p) => p.d === r.d && Math.abs(p.h - r.h) <= 1)) continue;
    picked.push(r);
  }

  return {
    slots: picked.map((p) => slot(p.d, p.h, p.n)),
    basedOn: events.length,
    estimated: false,
  };
}
