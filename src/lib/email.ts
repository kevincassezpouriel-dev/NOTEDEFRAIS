/**
 * Envoi d'e-mails via Resend (3 000 e-mails/mois gratuits). Optionnel : sans
 * RESEND_API_KEY, les fonctions renvoient false et l'app reste fonctionnelle
 * (le lien de validation reste visible dans l'admin, le rapport dans /admin).
 * Appel REST direct — pas de dépendance supplémentaire.
 */

export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !opts.to) return false;
  const from = process.env.REPORT_FROM || "MINGGLE <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
    });
    if (!res.ok) console.error("Resend:", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (err) {
    console.error("Envoi e-mail échoué :", err);
    return false;
  }
}

/** Gabarit HTML minimal et responsive, cohérent avec l'identité. */
export function emailShell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f9f9f7;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0b0b0b">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="font-weight:600;font-size:14px;margin-bottom:16px">▣ MINGGLE — QR Platform</div>
    <div style="background:#fff;border:1px solid rgba(11,11,11,.1);border-radius:12px;padding:24px">
      <h1 style="font-size:20px;margin:0 0 16px">${title}</h1>
      ${bodyHtml}
    </div>
    <p style="font-size:12px;color:#898781;margin-top:16px">Message automatique de votre plateforme MINGGLE.</p>
  </div>
</body></html>`;
}

export function button(href: string, label: string, color = "#2a78d6"): string {
  return `<a href="${href}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:500;font-size:14px">${label}</a>`;
}
