/**
 * Spec visuelle d'un post : les décisions de « montage » prises par l'IA
 * (ou par vous dans l'éditeur). Le rendu est fait par /api/og/{slug} avec
 * l'identité de marque — la charte (couleurs, logo, typo) reste VERROUILLÉE,
 * mais chaque post combine librement gabarit, style de fond, couleur d'accent
 * (piochée dans la palette), motif illustré et mode → des visuels vraiment
 * différents d'un post à l'autre. `diversifyVisual` garantit en plus qu'un
 * nouveau post ne répète jamais la combinaison des posts récents.
 */
export type Template =
  | "annonce"
  | "astuce"
  | "stat"
  | "citation"
  | "duo"
  | "checklist"
  | "punch"
  | "temoignage"
  | "match"
  | "meme"
  | "app"
  | "editorial";

export type BgStyle =
  | "auto"
  | "mesh"
  | "diagonal"
  | "blobs"
  | "dots"
  | "rings"
  | "waves"
  | "pattern";

/** Motifs illustrés (dessinés en SVG par le moteur, aux couleurs de la marque). */
export type Motif =
  | "aucun"
  | "maison"
  | "coeur"
  | "cle"
  | "bulle"
  | "eclair"
  | "etoile"
  | "puzzle"
  | "pin"
  | "soleil"
  | "plante"
  | "tasse"
  | "fusee";

export interface CarouselSlide {
  headline: string; // une idée par slide (≤ 90 caractères)
  subline: string; // développement court (≤ 130 caractères, peut être vide)
}

export interface VisualSpec {
  template: Template;
  headline: string; // punchline courte affichée sur l'image (≤ 90 caractères)
  subline: string; // ligne secondaire (≤ 110 caractères, peut être vide)
  accentIndex: number; // index de la couleur d'accent dans la palette de marque
  mode: "sombre" | "clair";
  bg: BgStyle; // style de fond graphique (auto = choisi automatiquement, varié)
  motif: Motif; // illustration de marque intégrée à la composition
  bgImage?: string | null; // photo/visuel/meme en arrière-plan (data-URL ou URL http)
  bgAsset?: number; // index d'une image de la bibliothèque de marque (-1 = aucune)
  seed?: number; // graine de variation (dérivée du slug si absente)
  // Carrousel : slides de contenu APRÈS la couverture (le visuel principal est
  // la slide 1 / hook) ; la slide CTA finale est composée automatiquement.
  slides?: CarouselSlide[];
  // Réseaux cibles choisis par l'IA : le kit de publication sert chaque
  // visuel à la résolution officielle du réseau.
  channels?: string[];
}

/** Résolutions officielles par réseau — le kit de publication s'en sert. */
export const CHANNELS: { value: string; label: string; format: string; size: string }[] = [
  { value: "instagram-feed", label: "Instagram (feed)", format: "portrait", size: "1080×1350" },
  { value: "instagram-story", label: "Instagram Story", format: "story", size: "1080×1920" },
  { value: "tiktok", label: "TikTok", format: "story", size: "1080×1920" },
  { value: "linkedin", label: "LinkedIn", format: "", size: "1200×630" },
  { value: "facebook", label: "Facebook", format: "", size: "1200×630" },
  { value: "x", label: "X (Twitter)", format: "", size: "1200×630" },
];

export const TEMPLATES: { value: Template; label: string }[] = [
  { value: "annonce", label: "Annonce (grand titre)" },
  { value: "astuce", label: "Astuce (pastille conseil)" },
  { value: "stat", label: "Chiffre fort" },
  { value: "citation", label: "Citation" },
  { value: "duo", label: "Duo (titre + accroche côte à côte)" },
  { value: "checklist", label: "Checklist (points clés)" },
  { value: "punch", label: "Punchline plein cadre" },
  { value: "temoignage", label: "Témoignage (avis + étoiles)" },
  { value: "match", label: "Carte de match (façon app)" },
  { value: "meme", label: "Meme (motif géant + texte choc)" },
  { value: "app", label: "Vitrine app (mockup téléphone)" },
  { value: "editorial", label: "Éditorial (typo expressive)" },
];

export const BG_STYLES: { value: BgStyle; label: string }[] = [
  { value: "auto", label: "Automatique (varié)" },
  { value: "mesh", label: "Halos dégradés" },
  { value: "diagonal", label: "Bandes diagonales" },
  { value: "blobs", label: "Formes organiques" },
  { value: "dots", label: "Trame de points" },
  { value: "rings", label: "Cercles concentriques" },
  { value: "waves", label: "Vagues" },
  { value: "pattern", label: "Motif répété (papier peint)" },
];

export const MOTIFS: { value: Motif; label: string }[] = [
  { value: "aucun", label: "Aucun" },
  { value: "maison", label: "🏠 Maison" },
  { value: "coeur", label: "❤️ Cœur" },
  { value: "cle", label: "🔑 Clé" },
  { value: "bulle", label: "💬 Bulle de chat" },
  { value: "eclair", label: "⚡ Éclair" },
  { value: "etoile", label: "⭐ Étoile" },
  { value: "puzzle", label: "🧩 Puzzle" },
  { value: "pin", label: "📍 Épingle" },
  { value: "soleil", label: "☀️ Soleil" },
  { value: "plante", label: "🌱 Plante" },
  { value: "tasse", label: "☕ Tasse" },
  { value: "fusee", label: "🚀 Fusée" },
];

const ALL_TEMPLATES: Template[] = TEMPLATES.map((t) => t.value);
const ALL_MOTIFS: Motif[] = MOTIFS.filter((m) => m.value !== "aucun").map((m) => m.value);
const CONCRETE_BGS: BgStyle[] = BG_STYLES.filter((b) => b.value !== "auto").map((b) => b.value);

/** Hash déterministe d'une chaîne (variation stable par slug). */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function defaultVisual(title: string): VisualSpec {
  const seed = hashString(title);
  return {
    template: ALL_TEMPLATES[seed % ALL_TEMPLATES.length],
    headline: title.slice(0, 80),
    subline: "",
    accentIndex: seed % 6,
    mode: seed % 3 === 0 ? "clair" : "sombre",
    bg: "auto",
    motif: ALL_MOTIFS[seed % ALL_MOTIFS.length],
    bgImage: null,
    seed,
  };
}

export function parseVisual(
  raw: string | null | undefined,
  title: string,
  slug?: string
): VisualSpec {
  const fallback = defaultVisual(title);
  fallback.seed = hashString(slug || title);
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw) as Partial<VisualSpec> & { accent?: string };

    // Rétro-compatibilité : ancien champ `accent` ("primaire"/"secondaire").
    let accentIndex = fallback.accentIndex;
    if (typeof v.accentIndex === "number" && v.accentIndex >= 0) {
      accentIndex = Math.floor(v.accentIndex);
    } else if (v.accent === "secondaire") {
      accentIndex = 1;
    } else if (v.accent === "primaire") {
      accentIndex = 0;
    }

    const bgImage =
      typeof v.bgImage === "string" && v.bgImage.trim() ? v.bgImage : null;

    return {
      template: ALL_TEMPLATES.includes(v.template as Template)
        ? (v.template as Template)
        : fallback.template,
      headline: (v.headline ?? fallback.headline).slice(0, 100),
      subline: (v.subline ?? "").slice(0, 130),
      accentIndex,
      mode: v.mode === "clair" ? "clair" : "sombre",
      bg: BG_STYLES.some((b) => b.value === v.bg) ? (v.bg as BgStyle) : "auto",
      motif: MOTIFS.some((m) => m.value === v.motif) ? (v.motif as Motif) : fallback.motif,
      bgImage,
      bgAsset:
        typeof v.bgAsset === "number" && v.bgAsset >= 0 ? Math.floor(v.bgAsset) : undefined,
      seed: typeof v.seed === "number" ? v.seed : fallback.seed,
      channels: Array.isArray(v.channels)
        ? v.channels.filter((c) => CHANNELS.some((ch) => ch.value === c)).slice(0, 6)
        : undefined,
      slides: Array.isArray(v.slides)
        ? v.slides
            .filter((sl) => sl && typeof sl.headline === "string")
            .slice(0, 8)
            .map((sl) => ({
              headline: sl.headline.slice(0, 100),
              subline: (sl.subline ?? "").slice(0, 140),
            }))
        : undefined,
    };
  } catch {
    return fallback;
  }
}

/** Résumé court d'un visuel (pour informer l'IA de ce qui a déjà été fait). */
export function describeVisual(v: VisualSpec): string {
  return `${v.template} / fond ${v.bg} / accent ${v.accentIndex} / ${v.mode}${
    v.motif !== "aucun" ? ` / motif ${v.motif}` : ""
  }`;
}

/**
 * GARDE-FOU ANTI-MONOTONIE : ajuste un visuel fraîchement généré pour qu'il
 * soit réellement différent des visuels récents, même si l'IA a rejoué la
 * même recette. Règles :
 *  - gabarit déjà utilisé dans les 2 derniers posts → gabarit le moins
 *    utilisé récemment (hors match/meme, qui exigent des textes dédiés) ;
 *  - même accent que le post précédent → accent suivant de la palette ;
 *  - même style de fond que le post précédent → style suivant ;
 *  - même mode 3 fois de suite → on inverse ;
 *  - même motif que le post précédent → motif suivant.
 */
export function diversifyVisual(spec: VisualSpec, recent: VisualSpec[]): VisualSpec {
  const out = { ...spec };
  const last = recent[0];

  if (recent.slice(0, 3).some((r) => r.template === out.template)) {
    const counts = new Map<Template, number>(ALL_TEMPLATES.map((t) => [t, 0]));
    for (const r of recent) counts.set(r.template, (counts.get(r.template) ?? 0) + 1);
    counts.delete(out.template);
    counts.delete("match");
    counts.delete("meme");
    counts.delete("app");
    let best: Template = "annonce";
    let bestCount = Infinity;
    for (const [t, c] of counts) {
      if (c < bestCount) {
        best = t;
        bestCount = c;
      }
    }
    out.template = best;
  }

  // Couleur : TOUJOURS différente du post précédent (rotation stricte).
  if (last) {
    out.accentIndex =
      last.accentIndex === out.accentIndex ? out.accentIndex + 1 : out.accentIndex;
    if (recent[1] && recent[1].accentIndex === out.accentIndex) out.accentIndex += 1;
  }

  if (last && last.bg !== "auto" && last.bg === out.bg) {
    const i = CONCRETE_BGS.indexOf(out.bg);
    out.bg = CONCRETE_BGS[(i + 1) % CONCRETE_BGS.length];
  }

  if (recent.length >= 3 && recent.slice(0, 3).every((r) => r.mode === out.mode)) {
    out.mode = out.mode === "sombre" ? "clair" : "sombre";
  }

  if (last && last.motif === out.motif) {
    const i = ALL_MOTIFS.indexOf(out.motif);
    out.motif = ALL_MOTIFS[(i + 1) % ALL_MOTIFS.length];
  }

  return out;
}
