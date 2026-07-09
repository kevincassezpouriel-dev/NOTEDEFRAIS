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
  typography: Typography;
  logo: string | null;
}

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
  const max = 256;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}

export default function MarquePage() {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

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
            <p className="text-xs font-medium mb-2">Palette</p>
            <div className="flex flex-wrap gap-4">
              <ColorField label="Principale" value={brand.colorPrimary}
                onChange={(v) => setBrand({ ...brand, colorPrimary: v })} />
              <ColorField label="Secondaire" value={brand.colorSecondary}
                onChange={(v) => setBrand({ ...brand, colorSecondary: v })} />
              <ColorField label="Fond sombre" value={brand.colorDark}
                onChange={(v) => setBrand({ ...brand, colorDark: v })} />
            </div>
          </div>
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
