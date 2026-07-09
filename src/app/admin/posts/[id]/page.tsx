"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { parseVisual, TEMPLATES, type VisualSpec } from "@/lib/visual";

interface PostDetail {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  hashtags: string | null;
  status: string;
  aiGenerated: boolean;
  visual: string | null;
  qrCodeId: string | null;
  campaignId: string | null;
}

interface Option {
  id: string;
  name: string;
}

export default function PostEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [visual, setVisual] = useState<VisualSpec | null>(null);
  const [visualVersion, setVisualVersion] = useState(0); // force le refresh de l'aperçu
  const [qrcodes, setQrcodes] = useState<Option[]>([]);
  const [campaigns, setCampaigns] = useState<Option[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [postRes, qrRes, campRes] = await Promise.all([
      fetch(`/api/admin/posts/${id}`, { cache: "no-store" }),
      fetch("/api/admin/qrcodes", { cache: "no-store" }),
      fetch("/api/admin/campaigns", { cache: "no-store" }),
    ]);
    if (postRes.ok) {
      const p = (await postRes.json()) as PostDetail;
      setPost(p);
      setVisual(parseVisual(p.visual, p.title));
    }
    if (qrRes.ok) setQrcodes(await qrRes.json());
    if (campRes.ok) setCampaigns(await campRes.json());
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(data: Record<string, unknown>, successMessage: string) {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/admin/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setBusy(false);
    if (res.ok) {
      setPost(await res.json());
      setVisualVersion((v) => v + 1); // rafraîchit l'aperçu du visuel
      setMessage({ text: successMessage, error: false });
    } else {
      const body = await res.json().catch(() => null);
      setMessage({ text: body?.error ?? "Erreur", error: true });
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!post) return;
    await patch(
      {
        title: post.title,
        content: post.content,
        excerpt: post.excerpt,
        hashtags: post.hashtags,
        qrCodeId: post.qrCodeId,
        campaignId: post.campaignId,
        visual,
      },
      "✓ Enregistré."
    );
  }

  async function remove() {
    if (!post) return;
    if (!window.confirm(`Supprimer « ${post.title} » ?`)) return;
    const res = await fetch(`/api/admin/posts/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/posts");
  }

  if (!post) {
    return <p className="text-sm" style={{ color: "var(--text-muted)" }}>Chargement…</p>;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/posts" className="text-sm" style={{ color: "var(--text-muted)" }}>
          ← Posts
        </Link>
        <h1 className="text-xl font-semibold truncate">{post.title}</h1>
        {post.aiGenerated && <span className="text-xs">✨ généré par Claude</span>}
        {post.status === "published" && (
          <a
            href={`/news/${post.slug}`}
            target="_blank"
            className="text-xs underline ml-auto"
            style={{ color: "var(--good)" }}
          >
            Voir en ligne ↗
          </a>
        )}
      </div>

      <form onSubmit={save} className="card p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1" htmlFor="p-title">Titre</label>
          <input
            id="p-title"
            className="input"
            value={post.title}
            onChange={(e) => setPost({ ...post, title: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" htmlFor="p-excerpt">
            Accroche (légende réseaux sociaux)
          </label>
          <input
            id="p-excerpt"
            className="input"
            value={post.excerpt ?? ""}
            onChange={(e) => setPost({ ...post, excerpt: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" htmlFor="p-content">
            Contenu (markdown : ## titres, **gras**, listes, liens)
          </label>
          <textarea
            id="p-content"
            className="input font-mono text-xs !leading-relaxed"
            rows={16}
            value={post.content}
            onChange={(e) => setPost({ ...post, content: e.target.value })}
            required
          />
        </div>
        {/* Visuel de marque : le « montage » du post, éditable */}
        {visual && (
          <div className="border-t pt-4 space-y-3" style={{ borderColor: "var(--grid)" }}>
            <p className="text-xs font-medium">
              🎨 Visuel de marque{" "}
              <span className="font-normal" style={{ color: "var(--text-muted)" }}>
                — composé automatiquement aux couleurs de votre identité (palette verrouillée).
                Enregistrez pour rafraîchir l&apos;aperçu.
              </span>
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/og/${post.slug}?v=${visualVersion}`}
              alt="Aperçu du visuel du post"
              className="w-full max-w-lg rounded-lg border"
              style={{ borderColor: "var(--border)" }}
            />
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" htmlFor="v-template">Gabarit</label>
                <select
                  id="v-template"
                  className="input !w-auto"
                  value={visual.template}
                  onChange={(e) => setVisual({ ...visual, template: e.target.value as VisualSpec["template"] })}
                >
                  {TEMPLATES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" htmlFor="v-accent">Accent</label>
                <select
                  id="v-accent"
                  className="input !w-auto"
                  value={visual.accent}
                  onChange={(e) => setVisual({ ...visual, accent: e.target.value as VisualSpec["accent"] })}
                >
                  <option value="primaire">Couleur principale</option>
                  <option value="secondaire">Couleur secondaire</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" htmlFor="v-mode">Fond</label>
                <select
                  id="v-mode"
                  className="input !w-auto"
                  value={visual.mode}
                  onChange={(e) => setVisual({ ...visual, mode: e.target.value as VisualSpec["mode"] })}
                >
                  <option value="sombre">Sombre</option>
                  <option value="clair">Clair</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-56">
                <label className="block text-xs font-medium mb-1" htmlFor="v-headline">
                  Accroche sur l&apos;image (courte)
                </label>
                <input
                  id="v-headline"
                  className="input"
                  maxLength={90}
                  value={visual.headline}
                  onChange={(e) => setVisual({ ...visual, headline: e.target.value })}
                />
              </div>
              <div className="flex-1 min-w-56">
                <label className="block text-xs font-medium mb-1" htmlFor="v-subline">
                  Ligne secondaire (optionnelle)
                </label>
                <input
                  id="v-subline"
                  className="input"
                  maxLength={110}
                  value={visual.subline}
                  onChange={(e) => setVisual({ ...visual, subline: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Formats fournis aux réseaux : 1200×630 (partages) et 1080×1080 (Instagram,{" "}
              <a
                href={`/api/og/${post.slug}?format=carre`}
                target="_blank"
                className="underline"
              >
                voir le carré ↗
              </a>
              ).
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium mb-1" htmlFor="p-hashtags">Hashtags</label>
            <input
              id="p-hashtags"
              className="input"
              placeholder="#MINGGLE #app"
              value={post.hashtags ?? ""}
              onChange={(e) => setPost({ ...post, hashtags: e.target.value })}
            />
          </div>
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium mb-1" htmlFor="p-qr">
              Asset lié (bouton « Télécharger » tracké)
            </label>
            <select
              id="p-qr"
              className="input"
              value={post.qrCodeId ?? ""}
              onChange={(e) => setPost({ ...post, qrCodeId: e.target.value || null })}
            >
              <option value="">Aucun (QR principal)</option>
              {qrcodes.map((qr) => (
                <option key={qr.id} value={qr.id}>
                  {qr.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium mb-1" htmlFor="p-campaign">
              Campagne
            </label>
            <select
              id="p-campaign"
              className="input"
              value={post.campaignId ?? ""}
              onChange={(e) => setPost({ ...post, campaignId: e.target.value || null })}
            >
              <option value="">Aucune</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {message && (
          <p className="text-sm" style={{ color: message.error ? "var(--critical)" : "var(--good)" }}>
            {message.text}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <button type="submit" className="btn btn-secondary" disabled={busy}>
            Enregistrer le brouillon
          </button>
          {post.status !== "published" ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() =>
                patch(
                  { status: "published", title: post.title, content: post.content, excerpt: post.excerpt, hashtags: post.hashtags, qrCodeId: post.qrCodeId, campaignId: post.campaignId },
                  "✓ Publié sur /news — webhook réseaux sociaux notifié (si configuré)."
                )
              }
            >
              🚀 Publier
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => patch({ status: "draft" }, "Repassé en brouillon.")}
            >
              Dépublier
            </button>
          )}
          <button type="button" className="btn btn-danger ml-auto" onClick={remove}>
            Supprimer
          </button>
        </div>

        {/* Programmation (calendrier éditorial) */}
        {post.status !== "published" && (
          <div className="border-t pt-4" style={{ borderColor: "var(--grid)" }}>
            <label className="block text-xs font-medium mb-1" htmlFor="p-sched">
              🗓️ Programmer la publication (au lieu de publier tout de suite)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="p-sched"
                type="datetime-local"
                className="input !w-auto"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy || !scheduledAt}
                onClick={() =>
                  patch(
                    { status: "scheduled", scheduledAt: new Date(scheduledAt).toISOString() },
                    "🗓️ Programmé — le cron publiera à l'heure dite."
                  )
                }
              >
                Programmer
              </button>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                (le cron doit être actif ; voir Réglages)
              </span>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
