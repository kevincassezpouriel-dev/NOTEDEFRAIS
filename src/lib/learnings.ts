import { prisma } from "./prisma";
import { extractLearnings } from "./ai";
import { logAction } from "./actions";

/** Les apprentissages actifs les plus importants (contexte pour l'IA). */
export async function topLearnings(limit = 12): Promise<string[]> {
  const rows = await prisma.learning.findMany({
    where: { active: true },
    orderBy: [{ weight: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: { insight: true },
  });
  return rows.map((r) => r.insight);
}

/**
 * Fait analyser les stats par l'IA, enregistre les nouveaux apprentissages
 * (sans doublon) et les journalise. Renvoie le nombre de leçons ajoutées.
 */
export async function refreshLearnings(statsJson: string): Promise<number> {
  const known = await prisma.learning.findMany({
    where: { active: true },
    select: { insight: true },
  });
  const extracted = await extractLearnings(
    statsJson,
    known.map((k) => k.insight)
  );
  if (extracted.length === 0) return 0;

  await prisma.learning.createMany({
    data: extracted.map((l) => ({ insight: l.insight, evidence: l.evidence, weight: l.weight })),
  });
  await logAction({
    type: "learning.saved",
    actor: "ai",
    title: `${extracted.length} nouvel(le)s enseignement(s) tiré(s) des données`,
    detail: extracted.map((l) => `- ${l.insight}`).join("\n"),
  });
  return extracted.length;
}
