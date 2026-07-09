/**
 * Spec visuelle d'un post : les décisions de « montage » prises par l'IA
 * (ou par vous dans l'éditeur). Le rendu est fait par /api/og/{slug} avec
 * les couleurs de l'identité de marque — la palette est VERROUILLÉE, seuls
 * le gabarit, les textes, l'accent et le mode varient.
 */
export interface VisualSpec {
  template: "annonce" | "astuce" | "stat" | "citation";
  headline: string; // punchline courte affichée sur l'image (≤ 70 caractères)
  subline: string; // ligne secondaire (≤ 90 caractères, peut être vide)
  accent: "primaire" | "secondaire";
  mode: "sombre" | "clair";
}

export const TEMPLATES: { value: VisualSpec["template"]; label: string }[] = [
  { value: "annonce", label: "Annonce (grand titre)" },
  { value: "astuce", label: "Astuce (pastille conseil)" },
  { value: "stat", label: "Chiffre fort" },
  { value: "citation", label: "Citation" },
];

export function defaultVisual(title: string): VisualSpec {
  return {
    template: "annonce",
    headline: title.slice(0, 70),
    subline: "",
    accent: "primaire",
    mode: "sombre",
  };
}

export function parseVisual(raw: string | null | undefined, title: string): VisualSpec {
  const fallback = defaultVisual(title);
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw) as Partial<VisualSpec>;
    return {
      template: ["annonce", "astuce", "stat", "citation"].includes(v.template ?? "")
        ? (v.template as VisualSpec["template"])
        : fallback.template,
      headline: (v.headline ?? fallback.headline).slice(0, 90),
      subline: (v.subline ?? "").slice(0, 110),
      accent: v.accent === "secondaire" ? "secondaire" : "primaire",
      mode: v.mode === "clair" ? "clair" : "sombre",
    };
  } catch {
    return fallback;
  }
}
