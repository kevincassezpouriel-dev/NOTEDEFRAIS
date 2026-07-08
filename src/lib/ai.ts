import Anthropic from "@anthropic-ai/sdk";
import { slugify } from "./validate";

/**
 * Intégration Claude (API Anthropic) : génération de posts marketing et
 * analyse d'audience. Nécessite ANTHROPIC_API_KEY — sans clé, les
 * fonctionnalités IA sont simplement désactivées (le reste de la
 * plateforme fonctionne normalement).
 */

const MODEL = process.env.AI_MODEL || "claude-opus-4-8";

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

const BRAND_SYSTEM = `Tu es le responsable marketing de MINGGLE, une application mobile.
Tu écris en français, avec un ton moderne, direct et enthousiaste — jamais
ampoulé ni robotique. Ton unique objectif : faire connaître MINGGLE au plus
grand nombre et donner envie de télécharger l'application.
Règles :
- Pas de superlatifs creux ("révolutionnaire", "incroyable") ni de jargon.
- Des phrases courtes. Un appel à l'action clair.
- Les posts doivent être directement publiables sur un site et adaptables
  aux réseaux sociaux (Instagram, TikTok, LinkedIn, Facebook).`;

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
  },
  required: ["title", "excerpt", "content", "hashtags"],
  additionalProperties: false,
};

export interface GeneratedPost {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  hashtags: string[];
}

export async function generateMarketingPost(opts: {
  brief?: string;
  statsSummary?: string;
  campaignName?: string;
  trackedUrl?: string;
  existingTitles?: string[];
}): Promise<GeneratedPost> {
  const parts: string[] = [];
  if (opts.brief) {
    parts.push(`Brief du post à écrire :\n${opts.brief}`);
  } else {
    parts.push(
      "Écris un post de promotion de l'application MINGGLE. Choisis toi-même un angle original (usage concret, coulisses, astuce, témoignage fictif crédible…)."
    );
  }
  if (opts.campaignName) parts.push(`Campagne associée : ${opts.campaignName}`);
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

  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: BRAND_SYSTEM,
    output_config: { format: { type: "json_schema", schema: POST_SCHEMA } },
    messages: [{ role: "user", content: parts.join("\n\n") }],
  });

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
  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: `Tu es analyste growth marketing pour la marque MINGGLE (application mobile).
On te fournit les statistiques brutes des QR codes et liens de suivi
(scans par jour, appareils, pays/villes, navigateurs dont in-app Instagram/
TikTok, sources de trafic, conversions par campagne).
Ta mission : croiser ces données et livrer une analyse EXPLOITABLE, en français.
Format de réponse (markdown) :
## Ce qui fonctionne
## Ce qui ne fonctionne pas
## Recommandations (3 à 5 actions concrètes, priorisées)
Sois précis et chiffré (cite les données). Si les données sont trop maigres
pour conclure, dis-le honnêtement et recommande quoi mesurer.`,
    messages: [
      {
        role: "user",
        content: `Voici les statistiques des ${days} derniers jours :\n\n${statsJson}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("L'analyse a été refusée par le modèle.");
  }
  return response.content.find((b) => b.type === "text")?.text ?? "";
}
