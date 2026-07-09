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
  name: "MINGGLE",
  tagline: "L'app qui vous rapproche.",
  description:
    "MINGGLE est une application mobile disponible sur iOS et Android. Simple, rapide et gratuite.",
  tone:
    "Moderne, direct, enthousiaste. Phrases courtes. Jamais ampoulé ni robotique. Un appel à l'action clair dans chaque post.",
  audience: "Grand public francophone, 18-45 ans, utilisateurs mobiles.",
  pillars: "Astuces d'utilisation\nNouveautés de l'app\nCoulisses et vision\nTémoignages d'usage",
  avoid:
    "Superlatifs creux (révolutionnaire, incroyable)\nJargon technique\nPromesses non tenables\nSujets politiques ou polémiques\nComparaisons dénigrantes avec des concurrents",
  vocabulary: "rejoindre\nse retrouver\nen un instant\nensemble",
  emojiPolicy: "Un ou deux emojis maximum par post, pertinents — jamais de rangées d'emojis.",
  ctaExamples: "Téléchargez MINGGLE\nRejoignez la communauté\nEssayez gratuitement",
  colorPrimary: "#2a78d6",
  colorSecondary: "#1baf7a",
  colorDark: "#0d1b2e",
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
