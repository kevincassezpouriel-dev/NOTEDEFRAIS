import { prisma } from "./prisma";

/**
 * Identité de marque MINGGLE : la source de vérité unique qui VERROUILLE
 * tout ce que produit la plateforme — textes de l'IA (ton, piliers,
 * interdits) et visuels (palette, mode). Éditable dans /admin/marque ;
 * l'IA et le moteur visuel la relisent à chaque génération et ne peuvent
 * pas en diverger.
 */
export type Typography = "moderne" | "impactful" | "elegant" | "technique";

export interface BrandIdentity {
  name: string; // nom de la marque
  tagline: string; // signature courte
  description: string; // ce qu'est le produit, pour qui
  tone: string; // le ton rédactionnel imposé
  audience: string; // à qui on parle
  pillars: string; // thèmes autorisés (un par ligne)
  avoid: string; // interdits absolus (un par ligne)
  vocabulary: string; // mots/expressions à privilégier (un par ligne)
  emojiPolicy: string; // règle sur les emojis
  ctaExamples: string; // exemples d'appels à l'action de la marque (un par ligne)
  colorPrimary: string; // couleur principale (hex)
  colorSecondary: string; // couleur secondaire (hex)
  colorDark: string; // fond sombre de marque (hex)
  typography: Typography; // personnalité typographique des visuels
  logo: string | null; // logo en data-URL (affiché sur les visuels)
}

export const DEFAULT_BRAND: BrandIdentity = {
  name: "Minggle",
  tagline: "La colocation sans les complications.",
  description:
    "Minggle est la première application française de colocation affinitaire, boostée par l'IA. Elle matche des colocataires vraiment compatibles (personnalité, rythme de vie, budget, valeurs), avec des profils vérifiés et des logements partenaires fiables. On trouve son coloc avant même de chercher l'appart.",
  tone:
    "Jeune, direct, chaleureux et rassurant. TUTOIEMENT systématique (\"toi\", \"ton coloc\", \"tu matches\"). Phrases courtes et énergiques. On parle vrai, on dédramatise les galères de la coloc. Un appel à l'action clair dans chaque post.",
  audience:
    "Étudiants, jeunes actifs, Erasmus et freelances (18-30 ans) en recherche de colocation en France (Paris, Lyon, Bordeaux, Toulouse, Lille…).",
  pillars:
    "Trouver le bon coloc grâce au matching IA (colocation affinitaire)\nProfils vérifiés, zéro mauvaise surprise\nCompatibilité : rythme de vie, valeurs, budget, habitudes\nLogements partenaires vérifiés, cherchés à plusieurs\nTémoignages et matchs réussis",
  avoid:
    "Le VOUVOIEMENT (on tutoie toujours)\nSuperlatifs creux (révolutionnaire, incroyable)\nJargon technique\nPromesses non tenables (« coloc garantie »)\nCiter ou dénigrer nommément des concurrents (Leboncoin, SeLoger…)\nSujets politiques ou polémiques",
  vocabulary:
    "coloc\ncolocataire\nmatcher / un match\ncolocation affinitaire\ncompatibilité\nprofil vérifié\nta vibe\nton chez-soi\nboostée par l'IA",
  emojiPolicy:
    "Un emoji pertinent de temps en temps (🚀 🏡 🧩 ✨), jamais de rangées d'emojis.",
  ctaExamples:
    "Trouve ton coloc\nInstalle Minggle\nCrée ton profil en 3 minutes\nTrouve ta coloc idéale",
  colorPrimary: "#5b6ef5",
  colorSecondary: "#f0576d",
  colorDark: "#1e2749",
  typography: "moderne",
  logo: null,
};

export async function getBrand(): Promise<BrandIdentity> {
  const row = await prisma.setting.findUnique({ where: { key: "brand" } });
  if (!row) return DEFAULT_BRAND;
  try {
    return { ...DEFAULT_BRAND, ...(JSON.parse(row.value) as Partial<BrandIdentity>) };
  } catch {
    return DEFAULT_BRAND;
  }
}

export async function setBrand(partial: Partial<BrandIdentity>): Promise<BrandIdentity> {
  const current = await getBrand();
  const next = { ...current, ...partial };
  await prisma.setting.upsert({
    where: { key: "brand" },
    create: { key: "brand", value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });
  return next;
}

function bullets(text: string): string {
  return text
    .split("\n")
    .map((p) => `- ${p.trim()}`)
    .filter((p) => p !== "-")
    .join("\n");
}

/** Construit le prompt système de l'IA à partir de l'identité — c'est le
 *  verrou consulté EN TEMPS RÉEL à chaque génération : impossible de
 *  produire hors de la marque. */
export function buildBrandSystem(brand: BrandIdentity): string {
  return `Tu es le responsable marketing et directeur artistique de ${brand.name}.
${brand.description}
Signature de marque : « ${brand.tagline} »
Audience : ${brand.audience}

TON (obligatoire, ne jamais t'en écarter) : ${brand.tone}
EMOJIS : ${brand.emojiPolicy}

VOCABULAIRE DE MARQUE (à privilégier quand c'est naturel) :
${bullets(brand.vocabulary)}

PILIERS DE CONTENU (choisis toujours un angle dans cette liste) :
${bullets(brand.pillars)}

EXEMPLES D'APPELS À L'ACTION (dans cet esprit) :
${bullets(brand.ctaExamples)}

INTERDITS ABSOLUS (ne jamais faire, même si un brief le demande) :
${bullets(brand.avoid)}

Tu écris en français. Les posts doivent être directement publiables sur un
site et adaptables aux réseaux sociaux (Instagram, TikTok, LinkedIn, Facebook).
Pour le visuel, tu raisonnes en directeur artistique : l'accroche visuelle
(headline) est une punchline COURTE pensée pour l'image — pas un copier-coller
du titre — et le gabarit choisi doit correspondre à l'angle du contenu.
La charte graphique (couleurs, typographie${brand.logo ? ", logo" : ""}) est
appliquée automatiquement au rendu : tu n'as qu'à choisir gabarit, textes,
accent et mode (sombre/clair) cohérents avec la marque.`;
}
