const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_SLUGS = new Set(["admin", "api", "app", "privacy", "r"]);
const MAX_LOGO_BYTES = 300 * 1024;

export function validateSlug(slug: string): string | null {
  if (!SLUG_RE.test(slug) || slug.length > 60) {
    return "Slug invalide : lettres minuscules, chiffres et tirets uniquement";
  }
  if (RESERVED_SLUGS.has(slug)) return `Le slug « ${slug} » est réservé`;
  return null;
}

export function validateUrls(body: {
  appStoreUrl?: string;
  playStoreUrl?: string;
  fallbackUrl?: string;
}): string | null {
  for (const url of [body.appStoreUrl, body.playStoreUrl, body.fallbackUrl]) {
    if (url && url.trim() && !/^https?:\/\//i.test(url.trim())) {
      return "Les URLs doivent commencer par http:// ou https://";
    }
  }
  return null;
}

export function validateLogo(logo: string | null | undefined): string | null {
  if (logo == null || logo === "") return null;
  if (!logo.startsWith("data:image/")) return "Le logo doit être une image";
  if (logo.length > MAX_LOGO_BYTES * 1.4) return "Logo trop volumineux (max 300 Ko)";
  return null;
}

export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
