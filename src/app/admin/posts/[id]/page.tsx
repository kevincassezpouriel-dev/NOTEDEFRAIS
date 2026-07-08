"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";

interface PostDetail {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  hashtags: string | null;
  status: string;
  aiGenerated: boolean;
  qrCodeId: string | null;
}

interface QrOption {
  id: string;
  name: string;
}

export default function PostEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [qrcodes, setQrcodes] = useState<QrOption[]>([]);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [postRes, qrRes] = await Promise.all([
      fetch(`/api/admin/posts/${id}`, { cache: "no-store" }),
      fetch("/api/admin/qrcodes", { cache: "no-store" }),
    ]);
    if (postRes.ok) setPost(await postRes.json());
    if (qrRes.ok) setQrcodes(await qrRes.json());
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(data: Partial<PostDetail>, successMessage: string) {
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
              Campagne liée (lien tracké du bouton « Télécharger »)
            </label>
            <select
              id="p-qr"
              className="input"
              value={post.qrCodeId ?? ""}
              onChange={(e) => setPost({ ...post, qrCodeId: e.target.value || null })}
            >
              <option value="">Aucune (QR principal)</option>
              {qrcodes.map((qr) => (
                <option key={qr.id} value={qr.id}>
                  {qr.name}
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
                  { status: "published", title: post.title, content: post.content, excerpt: post.excerpt, hashtags: post.hashtags, qrCodeId: post.qrCodeId },
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
      </form>
    </div>
  );
}
