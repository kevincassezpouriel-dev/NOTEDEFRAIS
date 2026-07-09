import { prisma } from "./prisma";

export interface PostPerformance {
  postId: string;
  clicks: number; // scans dont la source = utmSource du post
  installs: number; // conversions attribuées au post
}

/**
 * Attribution par post : un post publié pointe vers /r|l/{slug}?utm_source=
 * post-{slug}. Les scans et conversions portant cette source lui sont
 * attribués. C'est ce qui ferme la boucle « contenu → résultat ».
 */
export async function postPerformance(utmSources: string[]): Promise<Map<string, PostPerformance>> {
  const sources = utmSources.filter(Boolean);
  const result = new Map<string, PostPerformance>();
  if (sources.length === 0) return result;

  const [scans, installs] = await Promise.all([
    prisma.scanEvent.groupBy({
      by: ["referrer"],
      where: { referrer: { in: sources } },
      _count: { _all: true },
    }),
    prisma.conversion.groupBy({
      by: ["source"],
      where: { source: { in: sources } },
      _count: { _all: true },
    }),
  ]);

  const clickBySource = new Map(scans.map((s) => [s.referrer ?? "", s._count._all]));
  const installBySource = new Map(installs.map((i) => [i.source ?? "", i._count._all]));

  for (const src of sources) {
    result.set(src, {
      postId: src,
      clicks: clickBySource.get(src) ?? 0,
      installs: installBySource.get(src) ?? 0,
    });
  }
  return result;
}

/** utm_source canonique d'un post, à partir de son slug. */
export function postUtmSource(slug: string): string {
  return `post-${slug}`;
}
