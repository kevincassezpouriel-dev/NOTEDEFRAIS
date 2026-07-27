import { prisma } from "./prisma";
import { getBrand, type BrandIdentity } from "./brand";
import { logAction } from "./actions";

/**
 * E-MAIL MARKETING : rendu HTML de marque + envoi de campagnes via Resend.
 *
 * - HTML « clients mail » : tables + styles inline (Gmail/Outlook/Apple Mail),
 *   600 px, couleurs et voix de la marque, bouton CTA, pied de désinscription.
 * - Tracking maison : pixel d'ouverture /api/e/o/…, clics via /api/e/c/…,
 *   désinscription en un clic /api/e/u/… — uniques par contact (vrais taux).
 * - Envoi par lots de 100 via l'endpoint batch de Resend.
 */

export interface CampaignContent {
  intro: string;
  sections: { title: string; body: string }[];
  ctaLabel: string;
  ctaUrl: string;
}

export function parseCampaignContent(raw: string): CampaignContent {
  try {
    const c = JSON.parse(raw) as Partial<CampaignContent>;
    return {
      intro: c.intro ?? "",
      sections: Array.isArray(c.sections)
        ? c.sections
            .filter((s) => s && typeof s.title === "string")
            .map((s) => ({ title: s.title, body: s.body ?? "" }))
        : [],
      ctaLabel: c.ctaLabel ?? "Découvrir",
      ctaUrl: c.ctaUrl ?? "",
    };
  } catch {
    return { intro: raw, sections: [], ctaLabel: "Découvrir", ctaUrl: "" };
  }
}

const esc = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Paragraphes + **gras** simple → HTML sûr. */
const para = (t: string, color: string) =>
  esc(t)
    .split(/\n{2,}|\n/)
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${color}">${p.replace(
          /\*\*([^*]+)\*\*/g,
          "<strong>$1</strong>"
        )}</p>`
    )
    .join("");

/**
 * Rendu HTML complet d'une campagne pour UN contact (liens tracés + unsub).
 * Sans contactId (aperçu admin), les liens de tracking sont neutralisés.
 */
export function renderCampaignHtml(opts: {
  brand: BrandIdentity;
  campaignId: string;
  subject: string;
  preheader?: string | null;
  content: CampaignContent;
  origin: string;
  contactId?: string;
}): string {
  const { brand, content, origin, campaignId, contactId } = opts;
  const accent = brand.colorPrimary;
  const dark = brand.colorDark;
  const track = (url: string) =>
    contactId
      ? `${origin}/api/e/c/${campaignId}/${contactId}?to=${encodeURIComponent(url)}`
      : url;
  const ctaUrl = content.ctaUrl ? track(content.ctaUrl) : `${origin}/download`;
  const unsubUrl = contactId ? `${origin}/api/e/u/${contactId}` : "#";
  const pixel = contactId
    ? `<img src="${origin}/api/e/o/${campaignId}/${contactId}" width="1" height="1" alt="" style="display:block;border:0" />`
    : "";
  const logo = brand.logo
    ? `<img src="${brand.logo.startsWith("data:") ? `${origin}/api/brand/logo` : brand.logo}" width="36" height="36" alt="" style="border-radius:9px;display:block" />`
    : `<div style="width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,${accent},${brand.colorSecondary})"></div>`;

  const sections = content.sections
    .map(
      (s) => `
      <h2 style="margin:26px 0 8px;font-size:17px;line-height:1.3;color:${dark}">${esc(s.title)}</h2>
      ${para(s.body, "#3d4155")}`
    )
    .join("");

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(opts.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f6;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${esc(opts.preheader ?? "")}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f6">
<tr><td align="center" style="padding:28px 12px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
    <tr><td style="padding:0 4px 14px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td>${logo}</td>
        <td style="padding-left:10px;font-family:Arial,Helvetica,sans-serif;font-weight:bold;font-size:16px;letter-spacing:.5px;color:${dark}">${esc(brand.name.toUpperCase())}</td>
      </tr></table>
    </td></tr>
    <tr><td style="background:#ffffff;border-radius:16px;overflow:hidden">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="height:5px;background:linear-gradient(90deg,${accent},${brand.colorSecondary});font-size:0">&nbsp;</td></tr>
        <tr><td style="padding:30px 32px 8px;font-family:Arial,Helvetica,sans-serif">
          <h1 style="margin:0 0 16px;font-size:23px;line-height:1.25;color:${dark}">${esc(opts.subject)}</h1>
          ${para(content.intro, "#3d4155")}
          ${sections}
        </td></tr>
        <tr><td align="center" style="padding:10px 32px 30px">
          <a href="${ctaUrl}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:13px 30px;border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-weight:bold;font-size:15px">${esc(content.ctaLabel)}</a>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:18px 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8a8da0" align="center">
      ${esc(brand.tagline)}<br />
      Tu reçois cet e-mail parce que tu t'es inscrit sur ${esc(brand.name)}.
      <a href="${unsubUrl}" style="color:#8a8da0">Se désinscrire</a>
    </td></tr>
  </table>
${pixel}
</td></tr></table>
</body></html>`;
}

/** Envoi par lots de 100 (endpoint batch Resend). Renvoie le nombre envoyé. */
export async function sendCampaign(
  campaignId: string,
  origin: string,
  segmentId?: string | null
): Promise<number> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY absente : configurez Resend pour envoyer.");
  const campaign = await prisma.emailCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campagne introuvable");
  if (campaign.status === "sent") throw new Error("Campagne déjà envoyée");

  const [brand, contacts] = await Promise.all([getBrand(), segmentContacts(segmentId)]);
  if (contacts.length === 0) throw new Error("Aucun contact abonné");

  const from =
    process.env.EMAIL_FROM || process.env.REPORT_FROM || `${brand.name} <onboarding@resend.dev>`;
  const content = parseCampaignContent(campaign.content);

  let sent = 0;
  for (let i = 0; i < contacts.length; i += 100) {
    const batch = contacts.slice(i, i + 100).map((c) => ({
      from,
      to: c.email,
      subject: campaign.subject,
      html: renderCampaignHtml({
        brand,
        campaignId: campaign.id,
        subject: campaign.subject,
        preheader: campaign.preheader,
        content,
        origin,
        contactId: c.id,
      }),
    }));
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify(batch),
    });
    if (res.ok) sent += batch.length;
    else console.error("Resend batch:", res.status, await res.text().catch(() => ""));
    if (i + 100 < contacts.length) await new Promise((r) => setTimeout(r, 700));
  }

  await prisma.emailCampaign.update({
    where: { id: campaign.id },
    data: { status: "sent", sentAt: new Date(), sentCount: sent },
  });
  await logAction({
    type: "report.sent",
    actor: "human",
    title: `Campagne e-mail envoyée : « ${campaign.subject} »`,
    detail: `${sent}/${contacts.length} contact(s).`,
    refType: "email",
    refId: campaign.id,
  });
  return sent;
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

/** Découpe une ligne CSV (séparateur , ou ; ou tab, guillemets gérés). */
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === sep && !inQ) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/**
 * Import en masse. Deux formats acceptés :
 * - CSV AVEC EN-TÊTE (une colonne contient les e-mails) : toutes les autres
 *   colonnes deviennent des ATTRIBUTS de profil (genre, age, statut,
 *   intérêts…) utilisables dans les listes ciblées.
 * - Texte libre : les e-mails sont extraits, sans attributs.
 */
export async function importContacts(raw: string, source = "import"): Promise<number> {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  let done = 0;

  const sep = [";", "\t", ","].find((c) => (lines[0] ?? "").includes(c)) ?? ",";
  const header = lines[0] ? splitCsvLine(lines[0], sep) : [];
  const emailCol = header.findIndex((h) => EMAIL_RE.test(h) === false && /mail/i.test(h));
  const looksCsv = lines.length > 1 && header.length > 1 && emailCol >= 0;

  if (looksCsv) {
    const keys = header.map((h) => h.toLowerCase().trim());
    for (const line of lines.slice(1, 10001)) {
      const cells = splitCsvLine(line, sep);
      const email = (cells[emailCol] ?? "").toLowerCase();
      if (!EMAIL_RE.test(email)) continue;
      const attributes: Record<string, string> = {};
      keys.forEach((k, i) => {
        if (i !== emailCol && cells[i]) attributes[k] = cells[i];
      });
      await prisma.contact.upsert({
        where: { email },
        create: { email, source, attributes: JSON.stringify(attributes) },
        update: { attributes: JSON.stringify(attributes) },
      });
      done++;
    }
    return done;
  }

  const emails = Array.from(
    new Set((raw.match(new RegExp(EMAIL_RE.source, "g")) ?? []).map((e) => e.toLowerCase()))
  ).slice(0, 10000);
  for (const email of emails) {
    await prisma.contact.upsert({ where: { email }, create: { email, source }, update: {} });
    done++;
  }
  return done;
}

/* ---------- Listes ciblées (segments) ---------- */
export interface SegmentRule {
  key: string; // attribut du profil (genre, age, statut, interets…)
  op: "contient" | "egal" | "min" | "max";
  value: string;
}

export function contactMatches(attributesJson: string | null, rules: SegmentRule[]): boolean {
  if (!rules.length) return true;
  let attrs: Record<string, string> = {};
  try {
    attrs = attributesJson ? (JSON.parse(attributesJson) as Record<string, string>) : {};
  } catch {
    /* profil illisible → ne matche que la liste complète */
  }
  const norm = (v: string) =>
    v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return rules.every((r) => {
    const rawVal = attrs[r.key.toLowerCase()] ?? "";
    if (r.op === "min" || r.op === "max") {
      const n = parseFloat(rawVal.replace(",", "."));
      const b = parseFloat(r.value.replace(",", "."));
      if (Number.isNaN(n) || Number.isNaN(b)) return false;
      return r.op === "min" ? n >= b : n <= b;
    }
    if (r.op === "egal") return norm(rawVal) === norm(r.value);
    return norm(rawVal).includes(norm(r.value));
  });
}

/** Contacts abonnés d'une liste ciblée (segmentId absent = liste complète). */
export async function segmentContacts(segmentId?: string | null) {
  const contacts = await prisma.contact.findMany({ where: { subscribed: true } });
  if (!segmentId) return contacts;
  const segment = await prisma.segment.findUnique({ where: { id: segmentId } });
  if (!segment) return contacts;
  let rules: SegmentRule[] = [];
  try {
    rules = JSON.parse(segment.rules) as SegmentRule[];
  } catch {
    /* règles illisibles → liste complète */
  }
  return contacts.filter((c) => contactMatches(c.attributes, rules));
}
