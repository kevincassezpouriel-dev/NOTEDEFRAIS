import { prisma } from "./prisma";
import { aiEnabled, generateMarketingPost } from "./ai";
import { computeStats, statsSummaryForAi } from "./stats";
import { refreshLearnings, topLearnings } from "./learnings";
import { createPost, publishPost } from "./posts";
import { getSettings } from "./settings";
import { logAction } from "./actions";
import { sendEmail, emailShell, button } from "./email";
import { createActionToken } from "./token";

export interface CycleResult {
  ran: boolean;
  reason?: string;
  learningsAdded?: number;
  postId?: string;
  postTitle?: string;
  published?: boolean;
  awaitingValidation?: boolean;
}

/**
 * Un cycle d'autopilote = la boucle d'apprentissage complète :
 *   1. Analyse des 30 derniers jours → nouveaux apprentissages (mémoire)
 *   2. Rédaction d'un post en APPLIQUANT les apprentissages
 *   3. Selon le mode : publication auto, ou brouillon + e-mail de validation
 * Journalise chaque étape dans la timeline.
 */
export async function runMarketingCycle(origin: string): Promise<CycleResult> {
  const settings = await getSettings();
  if (settings.autopilotMode === "off") {
    return { ran: false, reason: "Autopilote désactivé (mode off)." };
  }
  if (!aiEnabled()) {
    return { ran: false, reason: "ANTHROPIC_API_KEY absente." };
  }

  const stats = await computeStats(undefined, 30);
  const summary = statsSummaryForAi(stats);

  // 1. Mémoire : l'IA apprend de la période écoulée
  const learningsAdded = stats.period > 0 ? await refreshLearnings(summary) : 0;

  // 2. Rédaction, guidée par les apprentissages accumulés
  const [existingPosts, learnings, defaultAsset] = await Promise.all([
    prisma.post.findMany({ select: { title: true }, orderBy: { createdAt: "desc" }, take: 15 }),
    topLearnings(),
    prisma.qrCode.findFirst({ orderBy: { createdAt: "asc" } }),
  ]);

  const generated = await generateMarketingPost({
    statsSummary: stats.period > 0 ? summary : undefined,
    trackedUrl: assetUrl(origin, defaultAsset),
    existingTitles: existingPosts.map((p) => p.title),
    learnings,
  });

  const draft = await createPost({
    title: generated.title,
    slug: generated.slug,
    excerpt: generated.excerpt,
    content: generated.content,
    hashtags: generated.hashtags.join(" "),
    qrCodeId: defaultAsset?.id ?? null,
    campaignId: defaultAsset?.campaignId ?? null,
    aiGenerated: true,
  });

  await logAction({
    type: "autopilot.run",
    actor: "autopilot",
    title: "Cycle d'autopilote exécuté",
    detail: `${learningsAdded} apprentissage(s), post « ${draft.title} » ${
      settings.autopilotMode === "auto" ? "publié" : "en attente de validation"
    }.`,
    campaignId: draft.campaignId,
  });

  // 3. Publication auto, ou validation par e-mail
  if (settings.autopilotMode === "auto") {
    const post = await publishPost(draft.id, origin);
    return {
      ran: true,
      learningsAdded,
      postId: post.id,
      postTitle: post.title,
      published: true,
    };
  }

  await sendValidationEmail(draft.id, draft.title, draft.excerpt, origin, settings.reportEmail);
  return {
    ran: true,
    learningsAdded,
    postId: draft.id,
    postTitle: draft.title,
    awaitingValidation: true,
  };
}

export function assetUrl(
  origin: string,
  asset: { slug: string; type: string } | null
): string {
  const base = (process.env.APP_BASE_URL || origin).replace(/\/+$/, "");
  if (!asset) return `${base}/download`;
  return `${base}/${asset.type === "link" ? "l" : "r"}/${asset.slug}`;
}

async function sendValidationEmail(
  postId: string,
  title: string,
  excerpt: string | null,
  origin: string,
  to: string
): Promise<void> {
  if (!to) return;
  const token = await createActionToken("publish", postId);
  const publishUrl = `${origin}/action/publish?token=${encodeURIComponent(token)}`;
  const editUrl = `${origin}/admin/posts/${postId}`;
  const html = emailShell(
    "Un nouveau post attend votre validation",
    `<p style="color:#52514e;font-size:15px;line-height:1.5">L'autopilote a rédigé :</p>
     <p style="font-size:16px;font-weight:600;margin:8px 0">${title}</p>
     ${excerpt ? `<p style="color:#52514e;font-size:14px">${excerpt}</p>` : ""}
     <div style="margin:20px 0">${button(publishUrl, "🚀 Publier maintenant")}
     &nbsp;&nbsp;<a href="${editUrl}" style="font-size:14px;color:#2a78d6">Relire / modifier d'abord</a></div>
     <p style="font-size:12px;color:#898781">Le bouton publie sur /news et relaie aux réseaux (si le webhook est configuré).</p>`
  );
  const sent = await sendEmail({ to, subject: `À valider : ${title}`, html });
  await logAction({
    type: "alert",
    actor: "autopilot",
    title: sent
      ? "E-mail de validation envoyé"
      : "Post en attente de validation (e-mail non configuré)",
    detail: sent ? undefined : `Validez depuis l'admin : ${editUrl}`,
    status: "pending",
    refType: "post",
    refId: postId,
  });
}
