import Anthropic from "@anthropic-ai/sdk";
import { slugify } from "./validate";
import { buildBrandSystem, getBrand } from "./brand";
import { PLAYBOOK } from "./playbook";
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
        "Direction artistique du visuel de marque (rendu automatiquement dans la charte). Fais-le VARIER à chaque post : ne réutilise pas la même combinaison gabarit/fond/accent que d'habitude.",
      properties: {
        template: {
          type: "string" as const,
          enum: [
            "annonce",
            "astuce",
            "stat",
            "citation",
            "duo",
            "checklist",
            "punch",
            "temoignage",
            "match",
            "meme",
            "app",
            "editorial",
            "ia",
          ],
          description:
            "Gabarit adapté à l'angle : annonce (grand titre + preuve sociale), astuce (pastille conseil), stat (chiffre fort en très grand), citation (verbatim), duo (titre + accroche), checklist (points clés — mets-les dans subline séparés par « · »), punch (punchline plein cadre), temoignage (avis + étoiles), match (carte de match façon UI de l'app : headline = « Prénom + Prénom », subline = « NN % · tag · tag »), meme (motif géant + texte choc centré, énergie meme), app (vitrine produit : mockup téléphone), editorial (typo expressive centrée : lignes séparées par « | », alternance CAPITALES/serif italique, annotations dans subline séparées par « · » — le style studio de design)",
        },
        headline: {
          type: "string" as const,
          description:
            "Punchline COURTE affichée en grand sur l'image (max 60 caractères). MARQUAGE OBLIGATOIRE : surligne 1-2 mots clés entre crochets [comme ça] (rendu marqueur), mets 1 mot émotionnel entre astérisques *comme ça* (serif italique) OU souligne _comme ça_. Ex. : « Ta coloc [idéale] existe *vraiment* ». Pas un copier-coller du titre. Pour stat : le chiffre seul (ex. « 3× », « +120 % »). Pour match : « Prénom + Prénom »",
        },
        subline: {
          type: "string" as const,
          description:
            "Ligne secondaire sur l'image (max 90 caractères, ou vide). Pour checklist : 2-3 points séparés par « · ». Pour match : « 93 % · budget ok · même rythme »",
        },
        accentIndex: {
          type: "integer" as const,
          description:
            "Index de la couleur d'accent dans la palette de marque verrouillée (0 = principale, 1 = secondaire, 2+ = couleurs additionnelles). Varie-le d'un post à l'autre.",
        },
        bg: {
          type: "string" as const,
          enum: ["auto", "mesh", "diagonal", "blobs", "dots", "rings", "waves", "pattern"],
          description:
            "Style de fond graphique : auto (varié automatiquement), mesh (halos), diagonal (bandes), blobs (formes organiques), dots (trame de points), rings (cercles), waves (vagues), pattern (motif répété en papier peint). Choisis un style différent des posts précédents.",
        },
        motif: {
          type: "string" as const,
          enum: [
            "aucun",
            "maison",
            "coeur",
            "cle",
            "bulle",
            "eclair",
            "etoile",
            "puzzle",
            "pin",
            "soleil",
            "plante",
            "tasse",
            "fusee",
          ],
          description:
            "Illustration de marque intégrée au visuel (badge, meme ou papier peint). Choisis-la cohérente avec l'angle (ex. maison pour le logement, coeur pour un match, cle pour l'emménagement).",
        },
        mode: {
          type: "string" as const,
          enum: ["sombre", "clair"],
          description: "Fond sombre (impactant) ou clair (léger) selon le ton du post",
        },
        bgAsset: {
          type: "integer" as const,
          description:
            "Index (0+) d'une image de la bibliothèque de marque à poser en fond du visuel de couverture (la liste des images disponibles est fournie dans le brief), ou -1 pour aucune. Utilise un screen de l'app quand le post parle du produit.",
        },
        photoIdea: {
          type: "string" as const,
          description:
            "Si une VRAIE photo générée par IA renforcerait ce post (scène de vie en coloc, ambiance appart, moment authentique), décris la scène EN ANGLAIS en une phrase (sans aucun texte dans l'image). UTILISE-LA SUR LA PLUPART DES POSTS : c'est elle qui produit la créa finale complète (image + titre intégré, qualité agence). Chaîne vide seulement pour match/meme/stat.",
        },
        channels: {
          type: "array" as const,
          items: {
            type: "string" as const,
            enum: ["instagram-feed", "instagram-story", "tiktok", "linkedin", "facebook", "x"],
          },
          description:
            "RÉSEAUX CIBLES : choisis 2 à 4 réseaux adaptés au contenu (carrousel → instagram-feed en premier ; meme/punch → instagram-story + tiktok ; angle pro/chiffres → linkedin). Le kit de publication servira automatiquement le visuel à la résolution officielle de chaque réseau choisi.",
        },
        slides: {
          type: "array" as const,
          description:
            "CARROUSEL (format n°1 en engagement — produis-en un dès que le sujet s'y prête : astuces, étapes, liste, erreurs à éviter). 3 à 6 slides APRÈS la couverture : la couverture (headline ci-dessus) est le HOOK, chaque slide porte UNE idée, la slide CTA finale est ajoutée automatiquement. Tableau vide [] pour un post à visuel unique (meme, match, stat…).",
          items: {
            type: "object" as const,
            properties: {
              headline: {
                type: "string" as const,
                description: "L'idée de la slide, une phrase forte (max 70 caractères) — surligne le mot clé [comme ça]",
              },
              subline: {
                type: "string" as const,
                description: "Développement court (max 110 caractères, ou vide)",
              },
            },
            required: ["headline", "subline"],
            additionalProperties: false,
          },
        },
      },
      required: ["template", "headline", "subline", "accentIndex", "bg", "motif", "mode", "bgAsset", "photoIdea", "channels", "slides"],
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
  recentVisuals?: string[];
  /** Réseaux imposés par l'utilisateur : l'IA y adapte ton, format et visuel. */
  channels?: string[];
  /** Recherche web AVANT d'écrire : posts factuels (lieux réels, adresses,
   *  chiffres sourcés). Coût : ~10 $ / 1000 recherches + tokens. */
  research?: boolean;
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
  if (opts.recentVisuals?.length) {
    parts.push(
      `Visuels des posts récents (INTERDIT de reproduire ces combinaisons — change de gabarit, de fond, d'accent et de motif) :\n- ${opts.recentVisuals.join("\n- ")}`
    );
  }

  const brand = await getBrand();
  if (brand.assets?.length) {
    parts.push(
      `Images de la bibliothèque de marque disponibles pour le fond du visuel (champ bgAsset) :\n${brand.assets
        .map((a, i) => `${i} = ${a.name}`)
        .join("\n")}\n(-1 si aucune ne convient)`
    );
  }
  parts.unshift(
    "IDÉATION : avant d'écrire, fais 1 à 2 recherches web rapides (tendances colocation/logement du moment, actus, sujets qui émergent sur les réseaux) et choisis un angle ACTUEL et intéressant — jamais un sujet générique hors du temps."
  );
  if (opts.channels?.length) {
    parts.push(
      `RÉSEAUX CIBLES IMPOSÉS : ${opts.channels.join(", ")}. Adapte le ton, le format et le gabarit à ces réseaux (LinkedIn → angle pro et chiffré ; TikTok/Story → punchline percutante ; feed Instagram → carrousel privilégié) et renseigne EXACTEMENT ces réseaux dans visual.channels.`
    );
  }
  if (opts.research) {
    parts.unshift(
      `MODE RECHERCHE : avant d'écrire, utilise la recherche web pour réunir des FAITS RÉELS et ACTUELS (noms exacts, adresses, prix, chiffres, dates). Le post — et chaque slide du carrousel — doit reposer sur ces faits vérifiés : par exemple pour « les meilleurs restaurants où aller entre colocs à Paris », chaque slide = un restaurant réel avec son nom, son adresse et pourquoi il est parfait entre colocs. N'invente RIEN de factuel ; si tes recherches ne confirment pas une info, ne la publie pas.`
    );
  }
  const response = await client().messages.create({
    model: MODEL_WRITE,
    max_tokens: 16000,
    // Prompt de marque stable → mis en cache : les tokens du cadrage ne sont
    // facturés qu'à ~10 % lors des générations suivantes.
    system: [
      { type: "text", text: buildBrandSystem(brand) },
      { type: "text", text: PLAYBOOK, cache_control: { type: "ephemeral" } },
    ],
    ...reqOpts(MODEL_WRITE, opts.research ? "high" : "medium", POST_SCHEMA),
    // Idéation web systématique : 2-3 recherches rapides avant d'écrire
    // (tendances, actus) ; le mode recherche approfondie en autorise 5.
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: opts.research ? 5 : 3,
      },
    ],
    messages: [{ role: "user", content: parts.join("\n\n") }],
  } as Anthropic.Messages.MessageCreateParamsNonStreaming);

  if (response.stop_reason === "refusal") {
    throw new Error("La génération a été refusée par le modèle.");
  }
  const textBlocks = response.content.filter((b) => b.type === "text");
  const text = textBlocks[textBlocks.length - 1]?.text ?? "";
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

const COMPETITOR_SCHEMA = {
  type: "object" as const,
  properties: {
    competitor: { type: "string" as const, description: "Nom du concurrent analysé" },
    summary: {
      type: "string" as const,
      description: "Synthèse (4-6 phrases) : positionnement, ton, formats, fréquence, audience visée",
    },
    whatWorks: {
      type: "array" as const,
      description: "Ce qui marche chez lui et POURQUOI (3 à 6 observations, fondées sur ce que tu as trouvé)",
      items: {
        type: "object" as const,
        properties: {
          observation: { type: "string" as const, description: "L'observation, en une phrase" },
          why: { type: "string" as const, description: "Pourquoi ça marche (mécanisme d'engagement)" },
        },
        required: ["observation", "why"],
        additionalProperties: false,
      },
    },
    postIdeas: {
      type: "array" as const,
      description:
        "3 à 5 idées de posts POUR NOTRE marque, inspirées de ce qui marche chez le concurrent mais adaptées à notre identité (jamais du plagiat)",
      items: {
        type: "object" as const,
        properties: {
          brief: {
            type: "string" as const,
            description: "Brief prêt à donner au générateur de posts (2-3 phrases : angle, format, ton)",
          },
          angle: { type: "string" as const, description: "L'angle en une phrase" },
          format: {
            type: "string" as const,
            enum: ["carrousel", "meme", "temoignage", "stat", "annonce", "astuce"],
            description: "Format recommandé",
          },
        },
        required: ["brief", "angle", "format"],
        additionalProperties: false,
      },
    },
  },
  required: ["competitor", "summary", "whatWorks", "postIdeas"],
  additionalProperties: false,
};

export interface CompetitorAnalysis {
  competitor: string;
  summary: string;
  whatWorks: { observation: string; why: string }[];
  postIdeas: { brief: string; angle: string; format: string }[];
}

/**
 * VEILLE CONCURRENTIELLE : analyse un concurrent (URL de page sociale, site
 * ou simple nom) via le web public — recherches + lecture des pages
 * accessibles — et en déduit ce qui marche chez lui + des idées de posts
 * ADAPTÉES à notre marque. NB : les statistiques privées d'Instagram/TikTok
 * ne sont pas accessibles ; l'analyse croise ce qui est public (contenus,
 * presse, classements, avis).
 */
export async function analyzeCompetitor(input: string): Promise<CompetitorAnalysis> {
  const brand = await getBrand();
  const response = await client().messages.create({
    model: MODEL_WRITE,
    max_tokens: 16000,
    system: [
      { type: "text", text: buildBrandSystem(brand) },
      { type: "text", text: PLAYBOOK, cache_control: { type: "ephemeral" } },
    ],
    ...reqOpts(MODEL_WRITE, "high", COMPETITOR_SCHEMA),
    tools: [
      { type: "web_search_20250305", name: "web_search", max_uses: 8 },
      { type: "web_fetch_20250910", name: "web_fetch", max_uses: 5 },
    ],
    messages: [
      {
        role: "user",
        content: `Fais une veille concurrentielle sur : ${input}

Méthode :
1. Identifie qui c'est (recherche web). Si c'est une URL, essaie de la lire (web_fetch).
2. Étudie sa communication : angles, formats (carrousels ? memes ? témoignages ?), ton, ce que la presse/les avis/les classements en disent, ce qui semble le mieux fonctionner et POURQUOI.
3. Déduis des idées de posts pour NOTRE marque : on s'inspire des MÉCANISMES qui marchent (pas du contenu copié), adaptés à notre identité et nos piliers.
Si tu ne trouves pas assez d'informations fiables, dis-le dans summary et fonde les idées sur les mécanismes génériques du playbook.`,
      },
    ],
  } as Anthropic.Messages.MessageCreateParamsNonStreaming);

  if (response.stop_reason === "refusal") {
    throw new Error("L'analyse a été refusée par le modèle.");
  }
  const blocks = response.content.filter((b) => b.type === "text");
  const text = blocks[blocks.length - 1]?.text ?? "";
  return JSON.parse(text) as CompetitorAnalysis;
}

const INSPIRE_SCHEMA = {
  type: "object" as const,
  properties: {
    rationale: {
      type: "string" as const,
      description:
        "En 1-2 phrases : ce que tu as retenu de l'image de référence (composition, ambiance, hiérarchie) et comment tu l'as traduit dans notre système",
    },
    template: {
      type: "string" as const,
      enum: [
        "annonce", "astuce", "stat", "citation", "duo",
        "checklist", "punch", "temoignage", "match", "meme", "app",
      ],
      description: "Le gabarit de NOTRE moteur le plus proche de la structure de la référence",
    },
    headline: {
      type: "string" as const,
      description:
        "Accroche pour NOTRE post (max 60 caractères), dans l'esprit éditorial de la référence mais avec notre message — ne copie JAMAIS le texte de l'image",
    },
    subline: { type: "string" as const, description: "Ligne secondaire (max 90 caractères, ou vide)" },
    accentIndex: {
      type: "integer" as const,
      description: "Index dans notre palette dont la teinte se rapproche le plus de l'ambiance de la référence",
    },
    bg: {
      type: "string" as const,
      enum: ["auto", "mesh", "diagonal", "blobs", "dots", "rings", "waves", "pattern"],
      description: "Le style de fond de notre moteur le plus proche de la texture/du fond de la référence",
    },
    motif: {
      type: "string" as const,
      enum: ["aucun", "maison", "coeur", "cle", "bulle", "eclair", "etoile", "puzzle", "pin", "soleil", "plante", "tasse", "fusee"],
      description: "Motif cohérent avec l'imagerie de la référence",
    },
    mode: {
      type: "string" as const,
      enum: ["sombre", "clair"],
      description: "Selon la luminosité générale de la référence",
    },
  },
  required: ["rationale", "template", "headline", "subline", "accentIndex", "bg", "motif", "mode"],
  additionalProperties: false,
};

export interface InspireResult {
  rationale: string;
  template: string;
  headline: string;
  subline: string;
  accentIndex: number;
  bg: string;
  motif: string;
  mode: string;
}

/**
 * INSPIRATION PAR IMAGE (vision) : on lui montre un rendu qui te plaît
 * (Pinterest, post d'une autre marque…) → Claude analyse sa composition,
 * son ambiance et sa hiérarchie, puis la TRADUIT dans notre système de
 * gabarits, aux couleurs de notre charte, avec notre message. Jamais de
 * copie : on reprend la grammaire visuelle, pas le contenu.
 */
export async function inspireVisual(
  imageDataUrl: string,
  post: { title: string; excerpt?: string | null }
): Promise<InspireResult> {
  const match = imageDataUrl.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/);
  if (!match) throw new Error("Image de référence invalide (PNG/JPEG/WebP attendu).");
  const [, mediaType, data] = match;

  const brand = await getBrand();
  const pool = [brand.colorPrimary, brand.colorSecondary, ...(brand.palette ?? [])];
  const response = await client().messages.create({
    model: MODEL_WRITE,
    max_tokens: 4000,
    system: [{ type: "text", text: buildBrandSystem(brand), cache_control: { type: "ephemeral" } }],
    ...reqOpts(MODEL_WRITE, "medium", INSPIRE_SCHEMA),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType as "image/png", data },
          },
          {
            type: "text",
            text: `Voici une image de référence dont l'esthétique nous plaît.
Analyse sa composition (structure, hiérarchie du texte, densité), son ambiance
(clair/sombre, énergie) et son intention éditoriale, puis traduis-la dans NOTRE
système pour le post suivant :
Titre du post : ${post.title}
${post.excerpt ? `Accroche : ${post.excerpt}` : ""}
Notre palette d'accents (index) : ${pool.map((c, i) => `${i}=${c}`).join(", ")}
Règles : on reprend la GRAMMAIRE visuelle (structure, ambiance), jamais le texte
ni les éléments propres à l'autre marque. L'accroche produite porte NOTRE message.`,
          },
        ],
      },
    ],
  } as Anthropic.Messages.MessageCreateParamsNonStreaming);

  if (response.stop_reason === "refusal") {
    throw new Error("L'analyse de l'image a été refusée par le modèle.");
  }
  const blocks = response.content.filter((b) => b.type === "text");
  return JSON.parse(blocks[blocks.length - 1]?.text ?? "") as InspireResult;
}

const DNA_SCHEMA = {
  type: "object" as const,
  properties: {
    name: { type: "string" as const, description: "Nom de la marque" },
    tagline: { type: "string" as const, description: "Signature courte de la marque" },
    description: { type: "string" as const, description: "Ce qu'est le produit, pour qui (2-3 phrases)" },
    tone: { type: "string" as const, description: "Le ton rédactionnel constaté sur le site (tutoiement ? énergie ? registre ?)" },
    audience: { type: "string" as const, description: "L'audience visée, déduite du site" },
    pillars: { type: "string" as const, description: "4 à 6 thèmes de contenu, un par ligne (\\n)" },
    avoid: { type: "string" as const, description: "4 à 6 interdits éditoriaux cohérents avec la marque, un par ligne" },
    vocabulary: { type: "string" as const, description: "6 à 10 mots/expressions propres à la marque relevés sur le site, un par ligne" },
    ctaExamples: { type: "string" as const, description: "3 à 5 appels à l'action dans la voix du site, un par ligne" },
    emojiPolicy: { type: "string" as const, description: "Règle d'usage des emojis cohérente avec le ton" },
    colorPrimary: { type: "string" as const, description: "Couleur principale du site en hex #RRGGBB" },
    colorSecondary: { type: "string" as const, description: "Couleur secondaire en hex #RRGGBB" },
    colorDark: { type: "string" as const, description: "Couleur sombre/encre du site en hex #RRGGBB" },
    palette: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "2 à 4 couleurs d'accent supplémentaires vues sur le site (hex #RRGGBB)",
    },
    rationale: { type: "string" as const, description: "Ce que tu as observé pour aboutir à ce profil (2-3 phrases)" },
  },
  required: [
    "name", "tagline", "description", "tone", "audience", "pillars", "avoid",
    "vocabulary", "ctaExamples", "emojiPolicy", "colorPrimary", "colorSecondary",
    "colorDark", "palette", "rationale",
  ],
  additionalProperties: false,
};

export interface BrandDna {
  name: string; tagline: string; description: string; tone: string; audience: string;
  pillars: string; avoid: string; vocabulary: string; ctaExamples: string; emojiPolicy: string;
  colorPrimary: string; colorSecondary: string; colorDark: string; palette: string[];
  rationale: string;
}

/**
 * ADN DE MARQUE (méthode Pomelli / Google Labs) : on donne l'URL du site →
 * l'IA le lit (web_fetch) et le recoupe (web_search), puis en extrait le
 * profil complet — ton, audience, piliers, vocabulaire, palette de couleurs.
 * Le résultat PRÉ-REMPLIT la page Marque & IA : tu relis, ajustes, enregistres.
 */
export async function extractBrandDna(url: string): Promise<BrandDna> {
  const response = await client().messages.create({
    model: MODEL_WRITE,
    max_tokens: 8000,
    ...reqOpts(MODEL_WRITE, "high", DNA_SCHEMA),
    tools: [
      { type: "web_fetch_20250910", name: "web_fetch", max_uses: 6 },
      { type: "web_search_20250305", name: "web_search", max_uses: 4 },
    ],
    messages: [
      {
        role: "user",
        content: `Analyse ce site et établis l'ADN complet de la marque : ${url}

Méthode :
1. Lis la page d'accueil (web_fetch) et 1-2 pages clés si utile.
2. Complète par une recherche web si le site est peu bavard.
3. Extrais : le TON réel (tutoiement/vouvoiement, énergie, registre), l'audience,
   les thèmes récurrents (piliers), le vocabulaire distinctif, les appels à
   l'action utilisés, et la PALETTE de couleurs dominante du site (hex).
Reste fidèle à ce que tu OBSERVES — n'invente pas un positionnement.`,
      },
    ],
  } as Anthropic.Messages.MessageCreateParamsNonStreaming);

  if (response.stop_reason === "refusal") {
    throw new Error("L'analyse du site a été refusée par le modèle.");
  }
  const blocks = response.content.filter((b) => b.type === "text");
  return JSON.parse(blocks[blocks.length - 1]?.text ?? "") as BrandDna;
}

const CAMPAIGN_IDEAS_SCHEMA = {
  type: "object" as const,
  properties: {
    ideas: {
      type: "array" as const,
      description: "3 à 4 idées de campagnes marketing distinctes et actionnables",
      items: {
        type: "object" as const,
        properties: {
          name: { type: "string" as const, description: "Nom court de la campagne (max 50 caractères)" },
          objective: { type: "string" as const, description: "Objectif mesurable en une phrase" },
          angle: { type: "string" as const, description: "L'angle créatif en 1-2 phrases" },
          firstPostBrief: {
            type: "string" as const,
            description: "Brief du premier post de la campagne, prêt pour le générateur (2-3 phrases)",
          },
        },
        required: ["name", "objective", "angle", "firstPostBrief"],
        additionalProperties: false,
      },
    },
  },
  required: ["ideas"],
  additionalProperties: false,
};

export interface CampaignIdea {
  name: string;
  objective: string;
  angle: string;
  firstPostBrief: string;
}

/**
 * IDÉES DE CAMPAGNES (méthode Pomelli, étape 2) : à partir de l'ADN de
 * marque, du playbook et des performances réelles, propose des campagnes
 * prêtes à créer — chacune avec son premier post à générer en un clic.
 */
export async function generateCampaignIdeas(context: {
  statsSummary?: string;
  learnings?: string[];
  existingCampaigns?: string[];
}): Promise<CampaignIdea[]> {
  const brand = await getBrand();
  const parts = [
    "Propose des idées de campagnes marketing pour la marque (voir cadrage système).",
  ];
  if (context.existingCampaigns?.length) {
    parts.push(`Campagnes déjà existantes (n'en propose pas de redondantes) :\n- ${context.existingCampaigns.join("\n- ")}`);
  }
  if (context.learnings?.length) {
    parts.push(`Apprentissages tirés de nos performances (appuie-toi dessus) :\n- ${context.learnings.join("\n- ")}`);
  }
  if (context.statsSummary) parts.push(`Données d'audience récentes :\n${context.statsSummary}`);

  const response = await client().messages.create({
    model: MODEL_WRITE,
    max_tokens: 6000,
    system: [
      { type: "text", text: buildBrandSystem(brand) },
      { type: "text", text: PLAYBOOK, cache_control: { type: "ephemeral" } },
    ],
    ...reqOpts(MODEL_WRITE, "medium", CAMPAIGN_IDEAS_SCHEMA),
    messages: [{ role: "user", content: parts.join("\n\n") }],
  } as Anthropic.Messages.MessageCreateParamsNonStreaming);

  if (response.stop_reason === "refusal") return [];
  const blocks = response.content.filter((b) => b.type === "text");
  const parsed = JSON.parse(blocks[blocks.length - 1]?.text ?? "{}") as { ideas?: CampaignIdea[] };
  return parsed.ideas ?? [];
}
