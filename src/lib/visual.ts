/**
 * Spec visuelle d'un post : les décisions de « montage » prises par l'IA
 * (ou par vous dans l'éditeur). Le rendu est fait par /api/og/{slug} avec
 * l'identité de marque — la charte (couleurs, logo, typo) reste VERROUILLÉE,
 * mais chaque post combine librement gabarit, style de fond, couleur d'accent
 * (piochée dans la palette) et mode → des visuels vraiment différents d'un
 * post à l'autre.
 */
export type Template =
  | "annonce"
  | "astuce"
  | "stat"
  | "citation"
  | "duo"
  | "checklist"
  | "punch"
  | "temoignage";

export type BgStyle =
  | "auto"
  | "mesh"
  | "diagonal"
  | "blobs"
  | "dots"
  | "rings"
  | "waves";

export interface VisualSpec {
  template: Template;
  headline: string; // punchline courte affichée sur l'image (≤ 90 caractères)
  subline: string; // ligne secondaire (≤ 110 caractères, peut être vide)
  accentIndex: number; // index de la couleur d'accent dans la palette de marque
  mode: "sombre" | "clair";
  bg: BgStyle; // style de fond graphique (auto = choisi automatiquement, varié)
  bgImage?: string | null; // photo/visuel/meme en arrière-plan (data-URL ou URL http)
  seed?: number; // graine de variation (dérivée du slug si absente)
}

export const TEMPLATES: { value: Template; label: string }[] = [
  { value: "annonce", label: "Annonce (grand titre)" },
  { value: "astuce", label: "Astuce (pastille conseil)" },
  { value: "stat", label: "Chiffre fort" },
  { value: "citation", label: "Citation" },
  { value: "duo", label: "Duo (titre + accroche côte à côte)" },
  { value: "checklist", label: "Checklist (points clés)" },
  { value: "punch", label: "Punchline plein cadre" },
  { value: "temoignage", label: "Témoignage (avis + étoiles)" },
];

export const BG_STYLES: { value: BgStyle; label: string }[] = [
  { value: "auto", label: "Automatique (varié)" },
  { value: "mesh", label: "Halos dégradés" },
  { value: "diagonal", label: "Bandes diagonales" },
  { value: "blobs", label: "Formes organiques" },
  { value: "dots", label: "Trame de points" },
  { value: "rings", label: "Cercles concentriques" },
  { value: "waves", label: "Vagues" },
];

const ALL_TEMPLATES: Template[] = TEMPLATES.map((t) => t.value);

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
      bgImage,
      seed: typeof v.seed === "number" ? v.seed : fallback.seed,
    };
  } catch {
    return fallback;
  }
}
