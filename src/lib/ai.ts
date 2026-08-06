import Anthropic from "@anthropic-ai/sdk";
import { buildBrandSystem, getBrand } from "./brand";

/**
 * Intégration Claude (API Anthropic), réduite à ce dont l'opération terrain a
 * besoin : la rédaction des e-mails envoyés aux propriétaires et aux
 * candidats. Sans ANTHROPIC_API_KEY, la fonctionnalité est simplement
 * désactivée — le CRM fonctionne normalement.
 */
const MODEL_WRITE = process.env.AI_MODEL_WRITE || process.env.AI_MODEL || "claude-sonnet-5";

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

// Modèles « modernes » : acceptent la réflexion adaptative + le paramètre
// effort ; les autres non (on ne les envoie pas, pour éviter une erreur API).
function isModern(model: string): boolean {
  return /(opus-4-[678]|opus-5|sonnet-5|sonnet-4-6|fable-5|mythos-5)/.test(model);
}

function reqOpts(model: string, schema?: Record<string, unknown>): Record<string, unknown> {
  const outputConfig: Record<string, unknown> = {};
  if (schema) outputConfig.format = { type: "json_schema", schema };
  const opts: Record<string, unknown> = {};
  if (isModern(model)) {
    opts.thinking = { type: "adaptive" };
    outputConfig.effort = "medium";
  }
  if (Object.keys(outputConfig).length > 0) opts.output_config = outputConfig;
  return opts;
}

const EMAIL_SCHEMA = {
  type: "object" as const,
  properties: {
    subject: {
      type: "string" as const,
      description:
        "Objet de l'e-mail (max 55 caractères) : clair et concret, jamais racoleur — c'est lui qui fait le taux d'ouverture",
    },
    preheader: {
      type: "string" as const,
      description: "Texte d'aperçu dans la boîte de réception (max 90 caractères)",
    },
    intro: {
      type: "string" as const,
      description: "Accroche d'ouverture (2-3 phrases, dans la voix de la marque)",
    },
    sections: {
      type: "array" as const,
      description: "1 à 3 sections courtes et utiles",
      items: {
        type: "object" as const,
        properties: {
          title: { type: "string" as const, description: "Titre de section (max 60 caractères)" },
          body: { type: "string" as const, description: "2-4 phrases utiles, **gras** autorisé" },
        },
        required: ["title", "body"],
        additionalProperties: false,
      },
    },
    ctaLabel: { type: "string" as const, description: "Libellé du bouton (max 30 caractères)" },
  },
  required: ["subject", "preheader", "intro", "sections", "ctaLabel"],
  additionalProperties: false,
};

export interface GeneratedEmail {
  subject: string;
  preheader: string;
  intro: string;
  sections: { title: string; body: string }[];
  ctaLabel: string;
}

/** Rédige une campagne e-mail dans la voix de la marque. */
export async function generateEmailCampaign(opts: {
  brief?: string;
  recentSubjects?: string[];
}): Promise<GeneratedEmail> {
  const brand = await getBrand();
  const parts: string[] = [
    opts.brief
      ? `Brief de l'e-mail à écrire :\n${opts.brief}`
      : "Écris le prochain e-mail utile à envoyer à la liste : de la vraie valeur (bons plans logement, conseils colocation, vie étudiante à Compiègne), au plus une touche produit.",
  ];
  if (opts.recentSubjects?.length) {
    parts.push(`Objets déjà envoyés (ne te répète pas) :\n- ${opts.recentSubjects.join("\n- ")}`);
  }

  const response = await client().messages.create({
    model: MODEL_WRITE,
    max_tokens: 6000,
    system: [
      { type: "text", text: buildBrandSystem(brand), cache_control: { type: "ephemeral" } },
    ],
    ...reqOpts(MODEL_WRITE, EMAIL_SCHEMA),
    messages: [{ role: "user", content: parts.join("\n\n") }],
  } as Anthropic.Messages.MessageCreateParamsNonStreaming);

  if (response.stop_reason === "refusal") throw new Error("Génération refusée par le modèle.");
  const blocks = response.content.filter((b) => b.type === "text");
  return JSON.parse(blocks[blocks.length - 1]?.text ?? "") as GeneratedEmail;
}
