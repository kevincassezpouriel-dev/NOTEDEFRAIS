import { prisma } from "./prisma";
import { postPerformance } from "./attribution";
import { parseVisual } from "./visual";

export interface PostScore {
  title: string;
  template: string;
  clicks: number;
  installs: number;
}

/**
 * Bilan de performance des posts publiés : ce qui a marché (clics + installs
 * attribués) et ce qui n'a pas marché. Sert à faire RÉAJUSTER l'IA en
 * continu — elle voit ses meilleurs et pires posts avant d'en écrire un
 * nouveau, et en tire les angles/gabarits qui résonnent.
 */
export async function postScores(limit = 40): Promise<PostScore[]> {
  const posts = await prisma.post.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: { title: true, visual: true, utmSource: true },
  });
  const perf = await postPerformance(posts.map((p) => p.utmSource ?? "").filter(Boolean));
  return posts.map((p) => {
    const stat = p.utmSource ? perf.get(p.utmSource) : undefined;
    return {
      title: p.title,
      template: parseVisual(p.visual, p.title).template,
      clicks: stat?.clicks ?? 0,
      installs: stat?.installs ?? 0,
    };
  });
}

/** Résumé texte des meilleurs / moins bons posts, injecté dans le prompt
 *  de génération pour que l'IA capitalise sur ce qui fonctionne. */
export async function performanceBrief(): Promise<string | undefined> {
  const scores = await postScores();
  const withData = scores.filter((s) => s.clicks + s.installs > 0);
  if (withData.length < 2) return undefined; // pas assez de recul

  const ranked = [...withData].sort(
    (a, b) => b.installs * 5 + b.clicks - (a.installs * 5 + a.clicks)
  );
  const best = ranked.slice(0, 3);
  const worst = ranked.slice(-2).reverse();

  const fmt = (s: PostScore) =>
    `« ${s.title} » [gabarit ${s.template}] — ${s.clicks} clic(s), ${s.installs} install(s)`;

  // Gabarit le plus performant
  const byTemplate = new Map<string, { clicks: number; installs: number; n: number }>();
  for (const s of withData) {
    const t = byTemplate.get(s.template) ?? { clicks: 0, installs: 0, n: 0 };
    t.clicks += s.clicks;
    t.installs += s.installs;
    t.n += 1;
    byTemplate.set(s.template, t);
  }
  const templateRanking = [...byTemplate.entries()]
    .map(([tpl, v]) => `${tpl} (${(v.installs * 5 + v.clicks) / v.n} pts/post)`)
    .join(", ");

  return `Performances de tes posts précédents (capitalise sur ce qui marche, évite ce qui ne marche pas) :
MEILLEURS :
${best.map((s) => `- ${fmt(s)}`).join("\n")}
MOINS BONS :
${worst.map((s) => `- ${fmt(s)}`).join("\n")}
Gabarits par efficacité moyenne : ${templateRanking}`;
}
