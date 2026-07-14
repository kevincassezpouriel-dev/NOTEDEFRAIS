"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { parseVisual, TEMPLATES, BG_STYLES, MOTIFS, CHANNELS, type VisualSpec } from "@/lib/visual";

/** Réduit une image de fond en JPEG ≤ 1280 px (data-URL) pour l'embarquer. */
async function fileToBg(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const max = 1280;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.72);
}

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
  const [pool, setPool] = useState<string[]>([]); // palette d'accents (couleurs de marque)
  const [assets, setAssets] = useState<{ name: string; data: string }[]>([]); // bibliothèque de marque
  const [visualVersion, setVisualVersion] = useState(0); // force le refresh de l'aperçu
  const [qrcodes, setQrcodes] = useState<Option[]>([]);
  const [campaigns, setCampaigns] = useState<Option[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [postRes, qrRes, campRes, brandRes] = await Promise.all([
      fetch(`/api/admin/posts/${id}`, { cache: "no-store" }),
      fetch("/api/admin/qrcodes", { cache: "no-store" }),
      fetch("/api/admin/campaigns", { cache: "no-store" }),
      fetch("/api/admin/brand", { cache: "no-store" }),
    ]);
    if (postRes.ok) {
      const p = (await postRes.json()) as PostDetail;
      setPost(p);
      setVisual(parseVisual(p.visual, p.title, p.slug));
    }
    if (qrRes.ok) setQrcodes(await qrRes.json());
    if (campRes.ok) setCampaigns(await campRes.json());
    if (brandRes.ok) {
      const b = (await brandRes.json()) as {
        colorPrimary: string;
        colorSecondary: string;
        palette?: string[];
        assets?: { name: string; data: string }[];
      };
      setAssets(b.assets ?? []);
      const all = [b.colorPrimary, b.colorSecondary, ...(b.palette ?? [])]
        .map((c) => (c || "").toLowerCase())
        .filter((c) => /^#[0-9a-f]{6}$/.test(c));
      setPool(Array.from(new Set(all)));
    }
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
                <label className="block text-xs font-medium mb-1" htmlFor="v-bg">Style de fond</label>
                <select
                  id="v-bg"
                  className="input !w-auto"
                  value={visual.bg}
                  onChange={(e) => setVisual({ ...visual, bg: e.target.value as VisualSpec["bg"] })}
                >
                  {BG_STYLES.map((b) => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" htmlFor="v-motif">Motif</label>
                <select
                  id="v-motif"
                  className="input !w-auto"
                  value={visual.motif}
                  onChange={(e) => setVisual({ ...visual, motif: e.target.value as VisualSpec["motif"] })}
                >
                  {MOTIFS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" htmlFor="v-mode">Mode</label>
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
              <div className="flex items-end">
                <button
                  type="button"
                  className="btn btn-secondary"
                  title="Relance la composition du fond avec une nouvelle variation aléatoire"
                  onClick={() =>
                    setVisual({ ...visual, seed: Math.floor(Math.random() * 2147483646) + 1 })
                  }
                >
                  🎲 Varier
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Couleur d&apos;accent</label>
              <div className="flex flex-wrap items-center gap-2">
                {pool.map((c, i) => {
                  const on = (visual.accentIndex % (pool.length || 1)) === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Accent ${c}`}
                      onClick={() => setVisual({ ...visual, accentIndex: i })}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: c,
                        border: on ? "3px solid var(--text-primary)" : "1px solid var(--border)",
                        cursor: "pointer",
                      }}
                    />
                  );
                })}
                <Link href="/admin/marque" className="text-xs underline" style={{ color: "var(--text-muted)" }}>
                  + gérer la palette
                </Link>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" htmlFor="v-bgimg">
                Image de fond (photo / meme — optionnel)
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  id="v-bgimg"
                  type="file"
                  accept="image/*"
                  className="text-xs"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setVisual({ ...visual, bgImage: await fileToBg(file) });
                    } catch {
                      setMessage({ text: "Impossible de lire cette image", error: true });
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary !py-1 text-xs"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setMessage(null);
                    const res = await fetch("/api/admin/ai/image", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ postId: id, angle: visual.headline }),
                    });
                    setBusy(false);
                    if (res.ok) {
                      const p = (await res.json()) as PostDetail;
                      setPost(p);
                      setVisual(parseVisual(p.visual, p.title, p.slug));
                      setVisualVersion((v) => v + 1);
                      setMessage({ text: "✓ Image générée par IA et posée en fond.", error: false });
                    } else {
                      const b = await res.json().catch(() => null);
                      setMessage({ text: b?.error ?? "Échec de la génération d'image", error: true });
                    }
                  }}
                >
                  ✨ Générer une image (IA)
                </button>
                <label className="btn btn-secondary !py-1 text-xs cursor-pointer">
                  🎨 S&apos;inspirer d&apos;une image…
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      e.target.value = "";
                      setBusy(true);
                      setMessage({ text: "🎨 Analyse de la référence… (~20 s)", error: false });
                      try {
                        const image = await fileToBg(file);
                        const res = await fetch("/api/admin/ai/inspire", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ postId: id, image }),
                        });
                        setBusy(false);
                        if (res.ok) {
                          const data = (await res.json()) as {
                            post: PostDetail;
                            rationale: string;
                          };
                          setPost(data.post);
                          setVisual(parseVisual(data.post.visual, data.post.title, data.post.slug));
                          setVisualVersion((v) => v + 1);
                          setMessage({ text: `✓ Traduit dans ta charte — ${data.rationale}`, error: false });
                        } else {
                          const b = await res.json().catch(() => null);
                          setMessage({ text: b?.error ?? "Échec de l'analyse", error: true });
                        }
                      } catch {
                        setBusy(false);
                        setMessage({ text: "Impossible de lire cette image", error: true });
                      }
                    }}
                  />
                </label>
                {visual.bgImage && (
                  <button
                    type="button"
                    className="btn btn-secondary !py-1 text-xs"
                    onClick={() => setVisual({ ...visual, bgImage: null })}
                  >
                    Retirer l&apos;image
                  </button>
                )}
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {visual.bgImage
                    ? "Photo posée en fond, texte et charte par-dessus."
                    : "Sans image : fond graphique généré (varié selon le post)."}
                </span>
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
            {assets.length > 0 && (
              <div>
                <label className="block text-xs font-medium mb-1">
                  Ou une image de la bibliothèque de marque
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {assets.map((a, i) => {
                    const on = visual.bgAsset === i && !visual.bgImage;
                    return (
                      <button key={i} type="button" title={a.name}
                        onClick={() =>
                          setVisual({ ...visual, bgAsset: on ? undefined : i, bgImage: null })
                        }
                        style={{
                          border: on ? "3px solid var(--accent)" : "1px solid var(--border)",
                          borderRadius: 8, padding: 0, overflow: "hidden", cursor: "pointer",
                          background: "transparent",
                        }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.data} alt={a.name} style={{ width: 72, height: 44, objectFit: "cover", display: "block" }} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Carrousel : le format n°1 en engagement (voir playbook) */}
            <div className="border-t pt-3 space-y-2" style={{ borderColor: "var(--grid)" }}>
              <p className="text-xs font-medium">
                🎠 Carrousel{" "}
                <span className="font-normal" style={{ color: "var(--text-muted)" }}>
                  — le visuel ci-dessus est la couverture (hook) ; ajoute des slides (une
                  idée chacune), la slide CTA finale est composée automatiquement.
                </span>
              </p>
              {(visual.slides ?? []).map((sl, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono w-6 text-right" style={{ color: "var(--text-muted)" }}>
                    {String(i + 2).padStart(2, "0")}
                  </span>
                  <input
                    className="input flex-1 min-w-44"
                    maxLength={90}
                    placeholder="L'idée de la slide (une phrase forte)"
                    value={sl.headline}
                    onChange={(e) => {
                      const slides = [...(visual.slides ?? [])];
                      slides[i] = { ...slides[i], headline: e.target.value };
                      setVisual({ ...visual, slides });
                    }}
                  />
                  <input
                    className="input flex-1 min-w-44"
                    maxLength={130}
                    placeholder="Développement court (optionnel)"
                    value={sl.subline}
                    onChange={(e) => {
                      const slides = [...(visual.slides ?? [])];
                      slides[i] = { ...slides[i], subline: e.target.value };
                      setVisual({ ...visual, slides });
                    }}
                  />
                  <a
                    href={`/api/og/${post.slug}?slide=${i + 1}&format=portrait&v=${visualVersion}`}
                    target="_blank"
                    className="text-xs underline"
                    style={{ color: "var(--text-muted)" }}
                  >
                    voir ↗
                  </a>
                  <button
                    type="button"
                    aria-label="Retirer la slide"
                    className="text-xs w-5 h-5 rounded-full leading-none"
                    style={{ background: "var(--page)", color: "var(--text-muted)" }}
                    onClick={() =>
                      setVisual({ ...visual, slides: (visual.slides ?? []).filter((_, j) => j !== i) })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="btn btn-secondary !py-1 text-xs"
                  onClick={() =>
                    setVisual({
                      ...visual,
                      slides: [...(visual.slides ?? []), { headline: "", subline: "" }],
                    })
                  }
                >
                  + Ajouter une slide
                </button>
                {(visual.slides?.length ?? 0) > 0 && (
                  <a
                    href={`/api/og/${post.slug}?slide=${(visual.slides?.length ?? 0) + 1}&format=portrait&v=${visualVersion}`}
                    target="_blank"
                    className="text-xs underline"
                    style={{ color: "var(--text-muted)" }}
                  >
                    slide CTA finale ↗
                  </a>
                )}
              </div>
            </div>
            {/* Kit de publication : l'IA a choisi les réseaux, chaque visuel
                est servi à la résolution officielle — rien à calculer. */}
            <div className="border-t pt-3 space-y-2" style={{ borderColor: "var(--grid)" }}>
              <p className="text-xs font-medium">
                📤 Kit de publication{" "}
                <span className="font-normal" style={{ color: "var(--text-muted)" }}>
                  — l&apos;IA a choisi les réseaux ; clique un réseau pour l&apos;activer/le retirer,
                  puis télécharge chaque visuel à la bonne résolution (clic droit → enregistrer).
                </span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CHANNELS.map((ch) => {
                  const active = (visual.channels ?? []).includes(ch.value);
                  return (
                    <button key={ch.value} type="button"
                      className="text-xs px-2.5 py-1 rounded-full"
                      style={{
                        border: `1px solid ${active ? "var(--accent)" : "var(--baseline)"}`,
                        background: active ? "var(--accent-soft)" : "transparent",
                        color: active ? "var(--accent)" : "var(--text-muted)",
                        fontWeight: active ? 650 : 450,
                      }}
                      onClick={() => {
                        const cur = visual.channels ?? [];
                        setVisual({
                          ...visual,
                          channels: active ? cur.filter((c) => c !== ch.value) : [...cur, ch.value],
                        });
                      }}>
                      {ch.label}
                    </button>
                  );
                })}
              </div>
              {(visual.channels ?? []).map((cv) => {
                const ch = CHANNELS.find((c) => c.value === cv);
                if (!ch) return null;
                const fmt = ch.format ? `&format=${ch.format}` : "";
                const fmt0 = ch.format ? `?format=${ch.format}` : "";
                const n = visual.slides?.length ?? 0;
                return (
                  <div key={cv} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold w-36">{ch.label}</span>
                    <span style={{ color: "var(--text-muted)" }}>{ch.size}</span>
                    <a href={`/api/og/${post.slug}${fmt0}`} target="_blank" className="underline">
                      {n > 0 ? "couverture ↗" : "visuel ↗"}
                    </a>
                    {n > 0 &&
                      Array.from({ length: n + 1 }).map((_, i) => (
                        <a key={i} href={`/api/og/${post.slug}?slide=${i + 1}${fmt}`}
                          target="_blank" className="underline" style={{ color: "var(--text-muted)" }}>
                          {i < n ? `s${i + 2} ↗` : "CTA ↗"}
                        </a>
                      ))}
                  </div>
                );
              })}
              <button type="button" className="btn btn-secondary !py-1 text-xs"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${post.excerpt ?? post.title}\n\n${post.hashtags ?? ""}`.trim()
                  );
                  setMessage({ text: "✓ Légende + hashtags copiés — colle-les dans ton post.", error: false });
                }}>
                📋 Copier la légende + hashtags
              </button>
            </div>
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
                title="Remplit avec le prochain créneau où ton audience est la plus active (analyse des scans réels)"
                onClick={async () => {
                  const res = await fetch("/api/admin/besttime", { cache: "no-store" });
                  if (!res.ok) return;
                  const bt = (await res.json()) as {
                    slots: { label: string; nextAt: string }[];
                    estimated: boolean;
                  };
                  const best = bt.slots[0];
                  if (!best) return;
                  const d = new Date(best.nextAt);
                  const pad = (n: number) => String(n).padStart(2, "0");
                  setScheduledAt(
                    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
                  );
                  setMessage({
                    text: `🕐 Meilleur créneau proposé : ${best.label}${bt.estimated ? " (estimation — pas encore assez de données)" : " (calculé sur ton audience réelle)"}.`,
                    error: false,
                  });
                }}
              >
                🕐 Meilleur créneau
              </button>
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
