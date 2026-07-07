export const DASHBOARD_TZ = process.env.DASHBOARD_TZ || "Europe/Paris";

/** Clé de jour "YYYY-MM-DD" dans le fuseau du tableau de bord. */
export function dayKey(d: Date, tz: string = DASHBOARD_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Liste des clés de jour des `days` derniers jours (du plus ancien à aujourd'hui). */
export function lastDayKeys(days: number, tz: string = DASHBOARD_TZ): string[] {
  const keys: string[] = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    keys.push(dayKey(new Date(now - i * 86_400_000), tz));
  }
  return keys;
}
