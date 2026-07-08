"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface PostRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  aiGenerated: boolean;
  createdAt: string;
  publishedAt: string | null;
  qrCode: { id: string; name: string } | null;
}

interface QrOption {
  id: string;
  name: string;
}

export default function PostsPage() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [qrcodes, setQrcodes] = useState<QrOption[]>([]);
  const [brief, setBrief] = useState("");
  const [qrCodeId, setQrCodeId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [postsRes, qrRes] = await Promise.all([
      fetch("/api/admin/posts", { cache: "no-store" }),
      fetch("/api/admin/qrcodes", { cache: "no-store" }),
    ]);
    if (postsRes.ok) setPosts(await postsRes.json());
    if (qrRes.ok) setQrcodes(await qrRes.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    setGenerating(true);
    setError(null);
    const res = await fetch("/api/admin/ai/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief: brief || undefined, qrCodeId: qrCodeId || undefined }),
    });
    setGenerating(false);
    if (res.ok) {
      setBrief("");
      load();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Erreur de génération");
    }
  }

  async function createManual() {
    const res = await fetch("/api/admin/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Nouveau post",
        content: "Écrivez votre contenu ici (markdown : ## titres, **gras**, listes)…",
      }),
    });
    if (res.ok) {
      const post = await res.json();
      window.location.href = `/admin/posts/${post.id}`;
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold mr-auto">Posts marketing</h1>
        <button onClick={createManual} className="btn btn-secondary">
          + Post manuel
        </button>
      </div>

      {/* Génération IA */}
      <div className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold">✨ Générer un post avec Claude</h2>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Claude rédige un brouillon en s&apos;appuyant sur vos statistiques de scans
          (ce qui fonctionne, quels canaux, quels appareils). Laissez le brief vide
          pour le laisser choisir l&apos;angle. Relisez toujours avant de publier.
        </p>
        <div className="flex flex-wrap gap-3">
          <input
            className="input flex-1 min-w-64"
            placeholder="Brief (optionnel) — ex. : « Post pour le lancement de la v2, ton fun »"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
          />
          <select
            className="input !w-auto"
            value={qrCodeId}
            onChange={(e) => setQrCodeId(e.target.value)}
            aria-label="Campagne à promouvoir"
          >
            <option value="">Campagne : QR principal</option>
            {qrcodes.map((qr) => (
              <option key={qr.id} value={qr.id}>
                {qr.name}
              </option>
            ))}
          </select>
          <button onClick={generate} className="btn btn-primary" disabled={generating}>
            {generating ? "Génération… (~30 s)" : "✨ Générer un brouillon"}
          </button>
        </div>
        {error && (
          <p className="text-sm" style={{ color: "var(--critical)" }}>
            {error}
          </p>
        )}
      </div>

      {/* Liste */}
      <div className="card p-4">
        {posts.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Aucun post. Générez-en un avec Claude ou créez-en un manuellement —
            les posts publiés apparaissent sur la page publique{" "}
            <a href="/news" target="_blank" className="underline">
              /news
            </a>
            .
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-xs border-b"
                  style={{ color: "var(--text-muted)", borderColor: "var(--grid)" }}
                >
                  <th className="py-2 pr-3 font-medium">Titre</th>
                  <th className="py-2 pr-3 font-medium">Campagne</th>
                  <th className="py-2 pr-3 font-medium">Origine</th>
                  <th className="py-2 pr-3 font-medium">Statut</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} className="border-b" style={{ borderColor: "var(--grid)" }}>
                    <td className="py-2.5 pr-3 font-medium max-w-md truncate">{post.title}</td>
                    <td className="py-2.5 pr-3">{post.qrCode?.name ?? "—"}</td>
                    <td className="py-2.5 pr-3">
                      {post.aiGenerated ? "✨ Claude" : "✍️ Manuel"}
                    </td>
                    <td className="py-2.5 pr-3">
                      {post.status === "published" ? (
                        <a
                          href={`/news/${post.slug}`}
                          target="_blank"
                          className="text-xs px-2 py-0.5 rounded-full underline"
                          style={{ color: "var(--good)", background: "var(--grid)" }}
                        >
                          Publié ↗
                        </a>
                      ) : (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full border"
                          style={{ color: "var(--text-muted)", borderColor: "var(--baseline)" }}
                        >
                          Brouillon
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      <Link href={`/admin/posts/${post.id}`} className="btn btn-secondary !py-1">
                        Éditer
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
