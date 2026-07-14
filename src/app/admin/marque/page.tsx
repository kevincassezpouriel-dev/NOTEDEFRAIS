"use client";

import { useCallback, useEffect, useState } from "react";

type Typography = "moderne" | "impactful" | "elegant" | "technique";

interface Brand {
  name: string;
  tagline: string;
  description: string;
  tone: string;
  audience: string;
  pillars: string;
  avoid: string;
  vocabulary: string;
  emojiPolicy: string;
  ctaExamples: string;
  colorPrimary: string;
  colorSecondary: string;
  colorDark: string;
  palette: string[];
  typography: Typography;
  logo: string | null;
  assets: { name: string; data: string }[];
}

const DEFAULT_NEW_COLOR = "#28c7a3";

const TYPO_OPTIONS: { value: Typography; label: string; hint: string }[] = [
  { value: "moderne", label: "Moderne", hint: "Sans-serif dense, minuscules" },
  { value: "impactful", label: "Impactant", hint: "Très gras, MAJUSCULES serrées" },
  { value: "elegant", label: "Élégant", hint: "Léger, aéré" },
  { value: "technique", label: "Technique", hint: "MAJUSCULES espacées" },
];

/** Redimensionne le logo en ≤ 256 px et renvoie une data-URL PNG. */
async function fileToLogo(file: File): Promise<string> {
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
  const max = 512;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}

/** Réduit une image de bibliothèque en JPEG ≤ 1280 px (data-URL). */
async function fileToAsset(file: File): Promise<string> {
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
  return c.toDataURL("image/jpeg", 0.8);
}

export default function MarquePage() {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dnaUrl, setDnaUrl] = useState("");
  const [dnaBusy, setDnaBusy] = useState(false);

  async function extractDna(e: React.FormEvent) {
    e.preventDefault();
    if (!brand) return;
    setDnaBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/ai/dna", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: dnaUrl }),
    });
    setDnaBusy(false);
    if (res.ok) {
      const dna = (await res.json()) as Partial<Brand> & { rationale?: string; palette?: string[] };
      setBrand({
        ...brand,
        ...(dna.name ? { name: dna.name } : {}),
        ...(dna.tagline ? { tagline: dna.tagline } : {}),
        ...(dna.description ? { description: dna.description } : {}),
        ...(dna.tone ? { tone: dna.tone } : {}),
        ...(dna.audience ? { audience: dna.audience } : {}),
        ...(dna.pillars ? { pillars: dna.pillars } : {}),
        ...(dna.avoid ? { avoid: dna.avoid } : {}),
        ...(dna.vocabulary ? { vocabulary: dna.vocabulary } : {}),
        ...(dna.ctaExamples ? { ctaExamples: dna.ctaExamples } : {}),
        ...(dna.emojiPolicy ? { emojiPolicy: dna.emojiPolicy } : {}),
        ...(/^#[0-9a-fA-F]{6}$/.test(dna.colorPrimary ?? "") ? { colorPrimary: dna.colorPrimary! } : {}),
        ...(/^#[0-9a-fA-F]{6}$/.test(dna.colorSecondary ?? "") ? { colorSecondary: dna.colorSecondary! } : {}),
        ...(/^#[0-9a-fA-F]{6}$/.test(dna.colorDark ?? "") ? { colorDark: dna.colorDark! } : {}),
        ...(Array.isArray(dna.palette)
          ? { palette: dna.palette.filter((c) => /^#[0-9a-fA-F]{6}$/.test(c)).map((c) => c.toLowerCase()) }
          : {}),
      });
      setMessage({
        text: `🧬 ADN extrait — ${dna.rationale ?? ""} Relis les champs ci-dessous puis Enregistre.`,
        error: false,
      });
    } else {
      const data = await res.json().catch(() => null);
      setMessage({ text: data?.error ?? "Échec de l'analyse du site", error: true });
    }
  }

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/brand", { cache: "no-store" });
    if (res.ok) setBrand(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!brand) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/admin/brand", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(brand),
    });
    setSaving(false);
    if (res.ok) {
      setBrand(await res.json());
      setMessage({
        text: "✓ Enregistré — l'IA relit ce cadrage à chaque génération, textes ET visuels s'y tiennent.",
        error: false,
      });
    } else {
      const data = await res.json().catch(() => null);
      setMessage({ text: data?.error ?? "Erreur", error: true });
    }
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !brand) return;
    try {
      setBrand({ ...brand, logo: await fileToLogo(file) });
    } catch {
      setMessage({ text: "Impossible de lire cette image", error: true });
    }
  }

  if (!brand) return <p className="text-sm" style={{ color: "var(--text-muted)" }}>Chargement…</p>;

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">Paramétrage IA &amp; identité de marque</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          C&apos;est le cadre que l&apos;IA <strong>consulte en temps réel</strong> à chaque
          génération. Elle écrit uniquement dans ce ton, sur ces piliers, en
          respectant ces interdits ; les visuels utilisent uniquement ce logo,
          cette typo et cette palette. Rien ne peut diverger de ce qui est défini ici.
        </p>
      </div>

      {/* ADN de marque (méthode Pomelli) : le site remplit la charte */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold mb-1">🧬 ADN de marque automatique</h2>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          Donne l&apos;URL de ton site : l&apos;IA le lit et en extrait ton profil complet —
          ton, audience, piliers, vocabulaire, appels à l&apos;action et palette de
          couleurs — puis pré-remplit tout le cadrage ci-dessous. Tu relis, tu
          ajustes, tu enregistres.
        </p>
        <form onSubmit={extractDna} className="flex flex-wrap gap-2">
          <input
            className="input flex-1 min-w-64"
            type="url"
            placeholder="https://www.minggle.fr"
            value={dnaUrl}
            onChange={(e) => setDnaUrl(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary" disabled={dnaBusy}>
            {dnaBusy ? "Lecture du site… (~1 min)" : "🧬 Analyser mon site"}
          </button>
        </form>
        {message && (
          <p className="text-sm mt-3" style={{ color: message.error ? "var(--critical)" : "var(--good)" }}>
            {message.text}
          </p>
        )}
      </div>

      <form onSubmit={save} className="card p-5 space-y-5">
        {/* Identité */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold">Identité</h2>
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-40">
              <label className="block text-xs font-medium mb-1" htmlFor="b-name">Nom de marque</label>
              <input id="b-name" className="input" value={brand.name}
                onChange={(e) => setBrand({ ...brand, name: e.target.value })} required />
            </div>
            <div className="flex-[2] min-w-56">
              <label className="block text-xs font-medium mb-1" htmlFor="b-tagline">Signature</label>
              <input id="b-tagline" className="input" value={brand.tagline}
                onChange={(e) => setBrand({ ...brand, tagline: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" htmlFor="b-desc">Description (ce qu&apos;est le produit)</label>
            <textarea id="b-desc" className="input" rows={2} value={brand.description}
              onChange={(e) => setBrand({ ...brand, description: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" htmlFor="b-audience">Audience</label>
            <textarea id="b-audience" className="input" rows={2} value={brand.audience}
              onChange={(e) => setBrand({ ...brand, audience: e.target.value })} />
          </div>
        </section>

        {/* Voix */}
        <section className="space-y-4 border-t pt-4" style={{ borderColor: "var(--grid)" }}>
          <h2 className="text-sm font-semibold">Voix &amp; règles rédactionnelles</h2>
          <div>
            <label className="block text-xs font-medium mb-1" htmlFor="b-tone">Ton imposé</label>
            <textarea id="b-tone" className="input" rows={2} value={brand.tone}
              onChange={(e) => setBrand({ ...brand, tone: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-56">
              <label className="block text-xs font-medium mb-1" htmlFor="b-vocab">
                Vocabulaire à privilégier (un par ligne)
              </label>
              <textarea id="b-vocab" className="input" rows={4} value={brand.vocabulary}
                onChange={(e) => setBrand({ ...brand, vocabulary: e.target.value })} />
            </div>
            <div className="flex-1 min-w-56">
              <label className="block text-xs font-medium mb-1" htmlFor="b-cta">
                Exemples d&apos;appels à l&apos;action (un par ligne)
              </label>
              <textarea id="b-cta" className="input" rows={4} value={brand.ctaExamples}
                onChange={(e) => setBrand({ ...brand, ctaExamples: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" htmlFor="b-emoji">Politique emojis</label>
            <input id="b-emoji" className="input" value={brand.emojiPolicy}
              onChange={(e) => setBrand({ ...brand, emojiPolicy: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-56">
              <label className="block text-xs font-medium mb-1" htmlFor="b-pillars">
                Piliers de contenu (un par ligne — l&apos;IA choisit toujours dedans)
              </label>
              <textarea id="b-pillars" className="input" rows={5} value={brand.pillars}
                onChange={(e) => setBrand({ ...brand, pillars: e.target.value })} />
            </div>
            <div className="flex-1 min-w-56">
              <label className="block text-xs font-medium mb-1" htmlFor="b-avoid">
                Interdits absolus (un par ligne — jamais, même sur brief)
              </label>
              <textarea id="b-avoid" className="input" rows={5} value={brand.avoid}
                onChange={(e) => setBrand({ ...brand, avoid: e.target.value })} />
            </div>
          </div>
        </section>

        {/* Charte visuelle */}
        <section className="space-y-4 border-t pt-4" style={{ borderColor: "var(--grid)" }}>
          <h2 className="text-sm font-semibold">Charte visuelle (verrouillée sur les visuels)</h2>

          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: brand.colorDark }}
            >
              {brand.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logo} alt="logo" className="max-w-12 max-h-12" />
              ) : (
                <span style={{ color: "#fff", fontSize: 11 }}>logo</span>
              )}
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1" htmlFor="b-logo">
                Logo (affiché sur chaque visuel)
              </label>
              <div className="flex items-center gap-2">
                <input id="b-logo" type="file" accept="image/*" onChange={onLogo} className="text-xs" />
                {brand.logo && (
                  <button type="button" className="btn btn-secondary !py-1 text-xs"
                    onClick={() => setBrand({ ...brand, logo: null })}>
                    Retirer
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium mb-2">Typographie des visuels</p>
            <div className="flex flex-wrap gap-2">
              {TYPO_OPTIONS.map((t) => {
                const on = brand.typography === t.value;
                return (
                  <button key={t.value} type="button"
                    onClick={() => setBrand({ ...brand, typography: t.value })}
                    className="px-3 py-2 rounded-lg text-left"
                    style={{
                      border: `1px solid ${on ? "var(--accent)" : "var(--baseline)"}`,
                      background: on ? "var(--page)" : "transparent",
                    }}>
                    <span className="text-sm font-medium block">{t.label}</span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{t.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium mb-1">Couleurs de rôle</p>
            <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
              Les trois couleurs structurelles de la charte.
            </p>
            <div className="flex flex-wrap gap-4">
              <ColorField label="Principale" value={brand.colorPrimary}
                onChange={(v) => setBrand({ ...brand, colorPrimary: v })} />
              <ColorField label="Secondaire" value={brand.colorSecondary}
                onChange={(v) => setBrand({ ...brand, colorSecondary: v })} />
              <ColorField label="Fond sombre" value={brand.colorDark}
                onChange={(v) => setBrand({ ...brand, colorDark: v })} />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium mb-1">Couleurs d&apos;accent additionnelles</p>
            <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
              Ajoute autant de couleurs que tu veux : chaque visuel en pioche une
              différente, ce qui rend les posts variés — tout en restant dans ta charte.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {brand.palette.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={c}
                    onChange={(e) => {
                      const next = [...brand.palette];
                      next[i] = e.target.value;
                      setBrand({ ...brand, palette: next });
                    }}
                    className="w-9 h-9 rounded cursor-pointer border-0 bg-transparent"
                    aria-label={`Couleur ${i + 1}`}
                  />
                  <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{c}</span>
                  <button
                    type="button"
                    aria-label="Retirer cette couleur"
                    className="text-xs w-5 h-5 rounded-full leading-none"
                    style={{ background: "var(--page)", color: "var(--text-muted)" }}
                    onClick={() =>
                      setBrand({ ...brand, palette: brand.palette.filter((_, j) => j !== i) })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-secondary !py-1 text-xs"
                onClick={() =>
                  setBrand({ ...brand, palette: [...brand.palette, DEFAULT_NEW_COLOR] })
                }
              >
                + Ajouter une couleur
              </button>
            </div>
          </div>
        </section>

        {/* Bibliothèque d'images de marque */}
        <section className="space-y-3 border-t pt-4" style={{ borderColor: "var(--grid)" }}>
          <h2 className="text-sm font-semibold">Bibliothèque d&apos;images de marque</h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Screens de l&apos;app, photos produit, ambiances… L&apos;IA et toi pouvez les
            poser en fond de n&apos;importe quel visuel (texte et charte composés
            par-dessus). Max 8 images.
          </p>
          <div className="flex flex-wrap gap-3">
            {brand.assets.map((a, i) => (
              <div key={i} className="w-28">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.data} alt={a.name} className="w-28 h-20 object-cover rounded border"
                  style={{ borderColor: "var(--border)" }} />
                <div className="flex items-center gap-1 mt-1">
                  <input
                    className="input !py-0.5 text-xs flex-1"
                    value={a.name}
                    onChange={(e) => {
                      const assets = [...brand.assets];
                      assets[i] = { ...assets[i], name: e.target.value };
                      setBrand({ ...brand, assets });
                    }}
                  />
                  <button type="button" aria-label="Retirer"
                    className="text-xs w-5 h-5 rounded-full leading-none shrink-0"
                    style={{ background: "var(--page)", color: "var(--text-muted)" }}
                    onClick={() => setBrand({ ...brand, assets: brand.assets.filter((_, j) => j !== i) })}>
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
          {brand.assets.length < 8 && (
            <input
              type="file"
              accept="image/*"
              multiple
              className="text-xs"
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []).slice(0, 8 - brand.assets.length);
                if (!files.length) return;
                try {
                  const added = await Promise.all(
                    files.map(async (f) => ({
                      name: f.name.replace(/\.[a-z]+$/i, "").slice(0, 60),
                      data: await fileToAsset(f),
                    }))
                  );
                  setBrand({ ...brand, assets: [...brand.assets, ...added] });
                } catch {
                  setMessage({ text: "Impossible de lire ces images", error: true });
                }
              }}
            />
          )}
        </section>

        {message && (
          <p className="text-sm" style={{ color: message.error ? "var(--critical)" : "var(--good)" }}>
            {message.text}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer le cadrage"}
        </button>
      </form>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent" aria-label={label} />
      <div>
        <p className="text-xs font-medium">{label}</p>
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{value}</p>
      </div>
    </div>
  );
}
