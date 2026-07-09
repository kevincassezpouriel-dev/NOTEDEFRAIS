import { prisma } from "./prisma";

/**
 * Paramètres clé/valeur éditables dans l'admin, avec repli sur les variables
 * d'environnement. La base a la priorité : on peut changer le comportement
 * sans redéployer.
 */

export type AutopilotMode = "off" | "draft" | "auto";

export interface Settings {
  autopilotMode: AutopilotMode; // off | draft (valider par e-mail) | auto (publier seul)
  reportEmail: string; // destinataire des rapports et validations
  monthlyBudgetEur: number; // plafond indicatif de dépense IA (0 = illimité)
}

const DEFAULTS: Settings = {
  autopilotMode: process.env.AUTOPILOT === "1" ? "auto" : "off",
  reportEmail: process.env.REPORT_EMAIL || "",
  monthlyBudgetEur: 0,
};

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const mode = map.get("autopilotMode");
  return {
    autopilotMode:
      mode === "off" || mode === "draft" || mode === "auto" ? mode : DEFAULTS.autopilotMode,
    reportEmail: map.get("reportEmail") ?? DEFAULTS.reportEmail,
    monthlyBudgetEur: Number(map.get("monthlyBudgetEur") ?? DEFAULTS.monthlyBudgetEur) || 0,
  };
}

export async function setSettings(partial: Partial<Settings>): Promise<void> {
  const entries: [string, string][] = [];
  if (partial.autopilotMode !== undefined) entries.push(["autopilotMode", partial.autopilotMode]);
  if (partial.reportEmail !== undefined) entries.push(["reportEmail", partial.reportEmail]);
  if (partial.monthlyBudgetEur !== undefined)
    entries.push(["monthlyBudgetEur", String(partial.monthlyBudgetEur)]);

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
    )
  );
}
