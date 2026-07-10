import Anthropic from "@anthropic-ai/sdk";
import { slugify } from "./validate";
import { buildBrandSystem, getBrand } from "./brand";
import type { VisualSpec } from "./visual";

/**
 * Intégration Claude (API Anthropic) : génération de posts marketing et
 * analyse d'audience. Nécessite ANTHROPIC_API_KEY — sans clé, les
 * fonctionnalités IA sont simplement désactivées (le reste de la
 * plateforme fonctionne normalement).
 */

/**
 * Modèles par tâche (optimisation coût / qualité) :
 * - ÉCRITURE (créatif) : Sonnet 5 par défaut — qualité quasi-Opus sur le
 *   copywriting marketing, à ~40 % du prix de sortie d'Opus.
 * - ANALYSE (mécanique : extraction d'apprentissages) : Haiku 4.5 — 5× moins
 *   cher, largement suffisant pour de l'extraction structurée.
 * Surchargeables via AI_MODEL_WRITE / AI_MODEL_ANALYZE, ou AI_MODEL pour tout.
 */
const MODEL_WRITE = process.env.AI_MODEL_WRITE || process.env.AI_MODEL || "claude-sonnet-5";
const MODEL_ANALYZE =
  process.env.AI_MODEL_ANALYZE || process.env.AI_MODEL || "claude-haiku-4-5";

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

// Modèles « modernes » : supportent la réflexion adaptative + le paramètre
// effort. Les autres (Haiku 4.5, Sonnet 4.5…) ne les acceptent pas → on
// n'envoie ni thinking ni effort pour éviter une erreur API.
function isModern(model: string): boolean {
  return /(opus-4-[678]|sonnet-5|sonnet-4-6|fable-5|mythos-5)/.test(model);
}

type Effort = "low" | "medium" | "high";

/** Assemble les options de requête adaptées au modèle (réflexion + effort +
 *  format structuré), pour maîtriser la dépense en tokens de réflexion. */
function reqOpts(
  model: string,
  effort: Effort,
  schema?: Record<string, unknown>
): Record<string, unknown> {
  const outputConfig: Record<string, unknown> = {};
  if (schema) outputConfig.format = { type: "json_schema", schema };
  const opts: Record<string, unknown> = {};
  if (isModern(model)) {
    opts.thinking = { type: "adaptive" };
    outputConfig.effort = effort;
  }
  if (Object.keys(outputConfig).length > 0) opts.output_config = outputConfig;
  return opts;
}

const POST_SCHEMA = {
  type: "object" as const,
  properties: {
    title: { type: "string" as const, description: "Titre accrocheur du post (max 80 caractères)" },
    excerpt: {
      type: "string" as const,
      description: "Accroche courte (1-2 phrases) utilisable comme légende réseaux sociaux",
    },
    content: {
      type: "string" as const,
      description: "Corps du post en markdown simple (titres ##, gras, listes), 150-400 mots",
    },
    hashtags: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "3 à 6 hashtags pertinents, avec le #",
    },
    visual: {
      type: "object" as const,
      description:
        "Direction artistique du visuel de marque qui accompagne le post (rendu automatiquement aux couleurs de la marque)",
      properties: {
        template: {
          type: "string" as const,
          enum: ["annonce", "astuce", "stat", "citation"],
          description:
            "Gabarit : annonce (grand titre), astuce (pastille conseil), stat (chiffre fort en très grand), citation (verbatim)",
        },
        headline: {
          type: "string" as const,
          description:
            "Punchline COURTE affichée en grand sur l'image (max 60 caractères). Pas un copier-coller du titre : pensée pour l'image. Pour le gabarit stat : le chiffre seul (ex. « 3× », « +120 % »)",
        },
        subline: {
          type: "string" as const,
          description: "Ligne secondaire sur l'image (max 90 caractères, ou vide)",
        },
        accent: {
          type: "string" as const,
          enum: ["primaire", "secondaire"],
          description: "Couleur d'accent (dans la palette de marque verrouillée)",
        },
        mode: {
          type: "string" as const,
          enum: ["sombre", "clair"],
          description: "Fond sombre (impactant) ou clair (léger) selon le ton du post",
        },
      },
      required: ["template", "headline", "subline", "accent", "mode"],
      additionalProperties: false,
    },
  },
  required: ["title", "excerpt", "content", "hashtags", "visual"],
  additionalProperties: false,
};

export interface GeneratedPost {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  hashtags: string[];
  visual: VisualSpec;
}

export async function generateMarketingPost(opts: {
  brief?: string;
  statsSummary?: string;
  campaignName?: string;
  campaignObjective?: string;
  trackedUrl?: string;
  existingTitles?: string[];
  learnings?: string[];
  performanceBrief?: string;
}): Promise<GeneratedPost> {
  const parts: string[] = [];
  if (opts.brief) {
    parts.push(`Brief du post à écrire :\n${opts.brief}`);
  } else {
    parts.push(
      "Écris un post de promotion de l'application. Choisis toi-même un angle original dans les piliers de la marque (astuce, coulisses, témoignage fictif crédible, mise en situation…)."
    );
  }
  if (opts.campaignName) {
    parts.push(
      `Campagne associée : ${opts.campaignName}${opts.campaignObjective ? ` — objectif : ${opts.campaignObjective}` : ""}`
    );
  }
  if (opts.learnings?.length) {
    parts.push(
      `Ce que tu as appris des performances passées (APPLIQUE ces leçons) :\n- ${opts.learnings.join("\n- ")}`
    );
  }
  if (opts.performanceBrief) {
    parts.push(opts.performanceBrief);
  }
  if (opts.trackedUrl) {
    parts.push(
      `Intègre naturellement ce lien de téléchargement dans le contenu (c'est un lien tracké) : ${opts.trackedUrl}`
    );
  }
  if (opts.statsSummary) {
    parts.push(
      `Données d'audience récentes (adapte l'angle à ce qui fonctionne) :\n${opts.statsSummary}`
    );
  }
  if (opts.existingTitles?.length) {
    parts.push(
      `Titres déjà publiés (n'écris PAS un post redondant avec ceux-ci) :\n- ${opts.existingTitles.join("\n- ")}`
    );
  }

  const brand = await getBrand();
  const response = await client().messages.create({
    model: MODEL_WRITE,
    max_tokens: 16000,
    // Prompt de marque stable → mis en cache : les tokens du cadrage ne sont
    // facturés qu'à ~10 % lors des générations suivantes.
    system: [
      { type: "text", text: buildBrandSystem(brand), cache_control: { type: "ephemeral" } },
    ],
    ...reqOpts(MODEL_WRITE, "medium", POST_SCHEMA),
    messages: [{ role: "user", content: parts.join("\n\n") }],
  } as Anthropic.Messages.MessageCreateParamsNonStreaming);

  if (response.stop_reason === "refusal") {
    throw new Error("La génération a été refusée par le modèle.");
  }
  const text = response.content.find((b) => b.type === "text")?.text ?? "";
  const parsed = JSON.parse(text) as Omit<GeneratedPost, "slug">;
  return { ...parsed, slug: slugify(parsed.title) };
}

/**
 * Analyse d'audience : croise les statistiques de scans/clics et renvoie
 * une analyse actionnable en français (ce qui marche, ce qui ne marche pas,
 * recommandations concrètes pour faire croître MINGGLE).
 */
export async function analyzeAudience(statsJson: string, days: number): Promise<string> {
  const brand = await getBrand();
  const response = await client().messages.create({
    model: MODEL_ANALYZE,
    max_tokens: 4000,
    ...reqOpts(MODEL_ANALYZE, "low"),
    system: `Tu es analyste growth marketing pour la marque ${brand.name} (application mobile).
On te fournit les statistiques brutes des QR codes et liens de suivi
(scans par jour, appareils, pays/villes, navigateurs dont in-app Instagram/
TikTok, sources de trafic, conversions par campagne).
Ta mission : croiser ces données et livrer une analyse EXPLOITABLE, en français.
Format de réponse (markdown) :
## Ce qui fonctionne
## Ce qui ne fonctionne pas
## Recommandations (3 à 5 actions concrètes, priorisées)
Sois précis et chiffré (cite les données). Si les données sont trop maigres
pour conclure, dis-le honnêtement et recommande quoi mesurer.
Objectif de la marque : faire croître ${brand.name} au plus grand nombre.`,
    messages: [
      {
        role: "user",
        content: `Voici les statistiques des ${days} derniers jours :\n\n${statsJson}`,
      },
    ],
  } as Anthropic.Messages.MessageCreateParamsNonStreaming);

  if (response.stop_reason === "refusal") {
    throw new Error("L'analyse a été refusée par le modèle.");
  }
  return response.content.find((b) => b.type === "text")?.text ?? "";
}

const LEARNINGS_SCHEMA = {
  type: "object" as const,
  properties: {
    learnings: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          insight: {
            type: "string" as const,
            description: "Leçon durable et actionnable, en une phrase (ex. « les scans du soir convertissent mieux »)",
          },
          evidence: { type: "string" as const, description: "La donnée chiffrée qui la fonde" },
          weight: {
            type: "integer" as const,
            description: "Importance de 1 (mineure) à 5 (majeure, à toujours garder en tête)",
          },
        },
        required: ["insight", "evidence", "weight"],
        additionalProperties: false,
      },
    },
  },
  required: ["learnings"],
  additionalProperties: false,
};

export interface ExtractedLearning {
  insight: string;
  evidence: string;
  weight: number;
}

/**
 * Extrait des apprentissages DURABLES des statistiques (ce qui restera vrai
 * la semaine prochaine). Alimente la mémoire de l'autopilote.
 */
export async function extractLearnings(
  statsJson: string,
  knownInsights: string[]
): Promise<ExtractedLearning[]> {
  const response = await client().messages.create({
    model: MODEL_ANALYZE,
    max_tokens: 4000,
    system: `Tu es analyste growth pour MINGGLE. À partir des statistiques, dégage
uniquement des ENSEIGNEMENTS DURABLES et actionnables — pas des observations
ponctuelles. Chaque leçon doit pouvoir guider la création des prochains posts
ou le choix des canaux. Ignore le bruit statistique (< 10 événements).
Ne répète PAS un enseignement déjà connu. S'il n'y a rien de solide à
conclure, renvoie une liste vide.`,
    ...reqOpts(MODEL_ANALYZE, "low", LEARNINGS_SCHEMA),
    messages: [
      {
        role: "user",
        content: `Enseignements déjà connus (ne pas répéter) :\n${
          knownInsights.length ? "- " + knownInsights.join("\n- ") : "(aucun)"
        }\n\nStatistiques :\n${statsJson}`,
      },
    ],
  } as Anthropic.Messages.MessageCreateParamsNonStreaming);

  if (response.stop_reason === "refusal") return [];
  const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
  try {
    const parsed = JSON.parse(text) as { learnings?: ExtractedLearning[] };
    return (parsed.learnings ?? []).map((l) => ({
      insight: l.insight,
      evidence: l.evidence,
      weight: Math.min(Math.max(Math.round(l.weight) || 1, 1), 5),
    }));
  } catch {
    return [];
  }
}
