import type { BrandIdentity } from "./brand";
import { getBrand } from "./brand";

/**
 * Génération d'IMAGES par IA (le « claude design » que tu voulais brancher).
 *
 * L'app déployée ne peut pas appeler un outil MCP : pour générer de vraies
 * images artistiques automatiquement, elle a besoin d'une API d'images à
 * elle. Ce module fournit ce point de branchement — générique et documenté :
 *
 *   IMAGE_API_KEY    (obligatoire pour activer)  → clé du fournisseur
 *   IMAGE_API_URL    (optionnel) → endpoint, défaut : OpenAI Images
 *                     (https://api.openai.com/v1/images/generations)
 *   IMAGE_API_MODEL  (optionnel) → modèle, défaut : "gpt-image-1"
 *   IMAGE_API_SIZE   (optionnel) → taille, défaut : "1024x1024"
 *
 * Le contrat est compatible OpenAI Images (beaucoup de fournisseurs le
 * répliquent). Sans clé, la génération d'images est simplement désactivée et
 * la plateforme retombe sur ses fonds graphiques générés + l'upload de photo.
 * L'image renvoyée est une data-URL, stockable directement dans le visuel du
 * post (champ bgImage).
 */

/* ---------- PHOTOS DE BANQUE GRATUITES (Pexels) ----------
 * Clé gratuite sur pexels.com/api (200 req/h, 20 000/mois) ; photos libres
 * pour usage commercial, sans attribution. C'est la voie « 0 € » : vraie
 * photo professionnelle en fond + notre typographie par-dessus = rendu
 * agence, texte toujours parfait, coût nul. On stocke l'URL (léger).
 */
export function stockEnabled(): boolean {
  return Boolean(process.env.PEXELS_API_KEY);
}

export async function searchStockPhoto(query: string): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key || !query.trim()) return null;
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=8&orientation=landscape`,
      { headers: { Authorization: key }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      photos?: { src?: { large2x?: string; large?: string } }[];
    };
    const photos = (data.photos ?? []).filter((ph) => ph.src?.large2x || ph.src?.large);
    if (!photos.length) return null;
    // Variété : pas toujours la 1re photo du classement
    const pick = photos[Math.floor(Math.random() * Math.min(photos.length, 5))];
    return pick.src?.large2x ?? pick.src?.large ?? null;
  } catch {
    return null;
  }
}

export function imageGenEnabled(): boolean {
  return Boolean(process.env.IMAGE_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENAI_API_KE);
}

/**
 * Construit une direction artistique d'image STRICTEMENT dans la charte :
 * sujet colocation/lifestyle, palette de marque, éditorial, SANS aucun texte
 * (le texte est composé par-dessus par le moteur visuel).
 */
export function buildImagePrompt(brand: BrandIdentity, opts: { headline?: string; angle?: string }): string {
  const palette = [brand.colorPrimary, brand.colorSecondary, ...(brand.palette ?? [])]
    .filter(Boolean)
    .join(", ");
  const focus = opts.headline || opts.angle || brand.tagline;
  return [
    `Complete, finished social media post design (agency quality) for the brand ${brand.name} — ${brand.description}`,
    opts.headline
      ? `The design MUST feature this exact French headline, rendered large, bold and perfectly readable with premium editorial typography (highlight 1-2 key words with a marker-style colored background): « ${opts.headline.replace(/[\[\]*_]/g, "") } »`
      : "",
    `Scene idea / angle: ${focus}.`,
    "Subject: young diverse roommates (18–30) in a bright, warm, real shared apartment in France — genuine candid lifestyle, natural light, cozy and friendly, aspirational but authentic.",
    `Color grading harmonised with the brand palette: ${palette}.`,
    "Composition: leave calm negative space (top-left and bottom) for text overlay. Modern, premium, magazine-quality.",
    "No watermark, no fake logos, no gibberish text — only the headline provided, spelled EXACTLY right.",
  ].join(" ");
}

interface OpenAIImageResponse {
  data?: { b64_json?: string; url?: string }[];
  error?: { message?: string };
}

/**
 * Génère une image et renvoie une data-URL (ou null si désactivé/en échec).
 * @throws en cas d'erreur API explicite (pour remonter un message clair à l'UI).
 */
export async function generateImage(prompt: string): Promise<string | null> {
  const key = process.env.IMAGE_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENAI_API_KE;
  if (!key) return null;

  const url = process.env.IMAGE_API_URL || "https://api.openai.com/v1/images/generations";
  const model = process.env.IMAGE_API_MODEL || "gpt-image-1";
  const size = process.env.IMAGE_API_SIZE || "1024x1024";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, prompt, size, n: 1 }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Fournisseur d'images : ${res.status} ${detail.slice(0, 300)}`);
    }
    const json = (await res.json()) as OpenAIImageResponse;
    const item = json.data?.[0];
    if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
    if (item?.url) {
      // Certains fournisseurs renvoient une URL : on la ramène en data-URL
      // pour la stocker et la rendre sans dépendance réseau au moment du rendu.
      const img = await fetch(item.url, { signal: controller.signal });
      const buf = Buffer.from(await img.arrayBuffer());
      const mime = img.headers.get("content-type") || "image/png";
      return `data:${mime};base64,${buf.toString("base64")}`;
    }
    throw new Error("Réponse du fournisseur d'images inattendue (ni b64_json ni url).");
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * PHOTO AUTOMATIQUE : appelée pendant la génération d'un post quand l'IA a
 * jugé qu'une vraie photo renforcerait le visuel (champ photoIdea). Ne casse
 * JAMAIS la création du post : toute erreur renvoie simplement null.
 */
export async function tryAutoPhoto(headline: string, photoIdea?: string): Promise<string | null> {
  if (!photoIdea?.trim()) return null;
  // 1. Banque de photos gratuite (Pexels) : vraie photo pro, coût 0 €.
  const stock = await searchStockPhoto(photoIdea);
  if (stock) return stock;
  // 2. Sans clé Pexels : pas de génération payante automatique — l'IA image
  //    (OpenAI) reste disponible via le bouton manuel de l'éditeur.
  return null;
}
