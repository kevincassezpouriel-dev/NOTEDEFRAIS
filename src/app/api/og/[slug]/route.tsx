import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBrand, accentPool } from "@/lib/brand";
import { parseVisual, hashString, type VisualSpec, type BgStyle, type Motif } from "@/lib/visual";
import type { BrandIdentity } from "@/lib/brand";

export const dynamic = "force-dynamic";

/* ---------- polices de marque (TTF servis depuis /public/fonts) ----------
 * Satori (le rasteriseur) n'a AUCUNE police par défaut digne d'un visuel de
 * marque : on embarque Space Grotesk (géométrique, moderne) et Archivo Black
 * (ultra-graisse pour le style « impactant »). Chargées une seule fois par
 * instance serveur. */
let fontsPromise:
  | Promise<{ name: string; data: ArrayBuffer; weight: 300 | 400 | 500 | 700; style: "normal" }[]>
  | null = null;
function loadFonts(origin: string) {
  if (!fontsPromise) {
    fontsPromise = Promise.all(
      (
        [
          { file: "SpaceGrotesk-Bold.ttf", name: "Space Grotesk", weight: 700 },
          { file: "SpaceGrotesk-Medium.ttf", name: "Space Grotesk", weight: 500 },
          { file: "SpaceGrotesk-Light.ttf", name: "Space Grotesk", weight: 300 },
          { file: "ArchivoBlack.ttf", name: "Archivo Black", weight: 400 },
          { file: "InstrumentSerif-Italic.ttf", name: "Instrument Serif", weight: 400 },
        ] as const
      ).map(async (f) => ({
        name: f.name,
        weight: f.weight,
        style: "normal" as const,
        // Disque d'abord (fiable sur Vercel, y compris derrière une
        // protection de déploiement) ; HTTP en secours (dev, autres runtimes).
        data: await readFile(path.join(process.cwd(), "public", "fonts", f.file))
          .then((b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer)
          .catch(async () => {
            const r = await fetch(`${origin}/fonts/${f.file}`);
            if (!r.ok) throw new Error(`police ${f.file} : ${r.status}`);
            return r.arrayBuffer();
          }),
      }))
    ).catch((e) => {
      fontsPromise = null; // retentera à la prochaine requête
      throw e;
    });
  }
  return fontsPromise;
}

/**
 * Moteur de composition visuelle : rend le visuel de marque d'un post.
 * La charte (couleurs, logo, typo) est verrouillée, MAIS chaque post combine
 * un gabarit, un style de fond procédural (dérivé du slug → toujours
 * différent), une couleur d'accent piochée dans la palette et un mode. On peut
 * aussi poser une vraie photo/meme en arrière-plan. Résultat : des visuels
 * variés, jamais deux fois le même, tout en restant strictement dans la marque.
 *
 *   /api/og/{slug}              → 1200×630 (partages, og:image)
 *   /api/og/{slug}?format=carre → 1080×1080 (Instagram)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  // bannière 1200×630 (défaut) · carré 1080×1080 (feed) · story 1080×1920
  const fmt = req.nextUrl.searchParams.get("format");
  const [width, height] =
    fmt === "carre"
      ? [1080, 1080]
      : fmt === "story"
        ? [1080, 1920]
        : fmt === "portrait"
          ? [1080, 1350] // format optimal des carrousels Instagram
          : [1200, 630];
  // Carrousel : ?slide=N rend la slide N (1 = 1re slide de contenu après la
  // couverture ; la dernière est la slide CTA composée automatiquement).
  const slideIdx = Math.max(0, parseInt(req.nextUrl.searchParams.get("slide") || "0", 10) || 0);

  const post = await prisma.post.findUnique({
    where: { slug },
    select: { title: true, visual: true },
  });
  if (!post) return new Response("Introuvable", { status: 404 });

  const brand = await getBrand();
  const visual = parseVisual(post.visual, post.title, slug);
  // Image de la bibliothèque de marque posée en fond (si pas d'image dédiée)
  if (!visual.bgImage && visual.bgAsset !== undefined) {
    visual.bgImage = brand.assets?.[visual.bgAsset]?.data ?? null;
  }
  // Sans les polices embarquées, le rendu retombe sur la police système.
  const fonts = await loadFonts(req.nextUrl.origin).catch(() => []);

  try {
    return new ImageResponse(render(visual, brand, width, height, slideIdx), {
      width,
      height,
      ...(fonts.length ? { fonts } : {}),
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch (err) {
    // Jamais d'icône d'image cassée : SVG de secours aux couleurs de la
    // marque + erreur dans les logs Vercel pour diagnostiquer.
    console.error("Rendu OG échoué :", err);
    const esc = (t: string) =>
      t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${brand.colorDark}"/>
    <stop offset="1" stop-color="${brand.colorPrimary}"/>
  </linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <text x="6%" y="30%" fill="#ffffff" font-family="sans-serif" font-size="${Math.round(width * 0.03)}" font-weight="700" letter-spacing="2">${esc(brand.name.toUpperCase())}</text>
  <text x="6%" y="55%" fill="#ffffff" font-family="sans-serif" font-size="${Math.round(width * 0.05)}" font-weight="800">${esc(visual.headline.slice(0, 40))}</text>
  <text x="6%" y="88%" fill="rgba(255,255,255,0.7)" font-family="sans-serif" font-size="${Math.round(width * 0.02)}">${esc(brand.tagline)}</text>
</svg>`;
    return new Response(svg, {
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
    });
  }
}

/* ---------- utilitaires couleur ---------- */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const to = (x: number, y: number) => Math.round(x + (y - x) * t);
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(to(r1, r2))}${h(to(g1, g2))}${h(to(b1, b2))}`;
}
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** PRNG déterministe (Lehmer) — variation stable par graine. */
function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const STAR_PATH =
  "M12 2l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.77l-5.88 3.09 1.12-6.55L2.48 8.92l6.58-.96z";
const CHECK_PATH = "M20 6L9 17l-5-5";

function stars(color: string, size: number) {
  return (
    <div style={{ display: "flex", gap: size * 0.14 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" style={{ display: "flex" }}>
          <path d={STAR_PATH} fill={color} />
        </svg>
      ))}
    </div>
  );
}

/* ---------- bibliothèque de motifs illustrés (trait arrondi, charte) ---------- */
type PathDef = { d: string; fill?: boolean };
const MOTIF_ART: Record<Exclude<Motif, "aucun">, PathDef[]> = {
  maison: [
    { d: "M3 11.5L12 4l9 7.5" },
    { d: "M5.5 10.5V20h13v-9.5" },
    { d: "M10 20v-5h4v5" },
  ],
  coeur: [
    {
      d: "M12 20.5C6.5 16 3.5 12.6 3.5 9.2 3.5 6.6 5.6 4.5 8.2 4.5c1.5 0 2.9.7 3.8 1.9a4.7 4.7 0 0 1 3.8-1.9c2.6 0 4.7 2.1 4.7 4.7 0 3.4-3 6.8-8.5 11.3z",
      fill: true,
    },
  ],
  cle: [
    { d: "M8 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" },
    { d: "M11 11l9.5 9.5" },
    { d: "M16.5 16.5l2.5-2.5" },
  ],
  bulle: [
    { d: "M4.5 5.5h15A1.5 1.5 0 0 1 21 7v8a1.5 1.5 0 0 1-1.5 1.5H10L4.5 21v-4.5h0A1.5 1.5 0 0 1 3 15V7a1.5 1.5 0 0 1 1.5-1.5z" },
    { d: "M8 11h0.01M12 11h0.01M16 11h0.01" },
  ],
  eclair: [{ d: "M13 2L4.5 13.5H11L9.5 22 18 10.5h-6.5L13 2z", fill: true }],
  etoile: [
    { d: "M12 2l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.77l-5.88 3.09 1.12-6.55L2.48 8.92l6.58-.96z", fill: true },
  ],
  puzzle: [{ d: "M5 9h3.2a2.3 2.3 0 1 1 4.6 0H16v3.2a2.3 2.3 0 1 0 0 4.6V20H5V9z" }],
  pin: [
    { d: "M12 21.5S18.5 15 18.5 10a6.5 6.5 0 1 0-13 0c0 5 6.5 11.5 6.5 11.5z" },
    { d: "M12 12.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z" },
  ],
  soleil: [
    { d: "M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z" },
    { d: "M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" },
  ],
  plante: [
    { d: "M12 21.5V11" },
    { d: "M12 14c0-4.5-3.2-7-7.5-7 0 4.5 3.2 7 7.5 7z" },
    { d: "M12 11c0-4.5 3.2-7 7.5-7 0 4.5-3.2 7-7.5 7z" },
  ],
  tasse: [
    { d: "M4 8.5h12.5V14a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8.5z" },
    { d: "M16.5 10h1.8a2.8 2.8 0 0 1 0 5.6h-1.8" },
    { d: "M8 5V3.5M11.5 5V3.5" },
  ],
  fusee: [
    { d: "M12 2.5c3.5 2 5.5 5.5 5.5 9.5l-2.5 3h-6L6.5 12c0-4 2-7.5 5.5-9.5z" },
    { d: "M12 11.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" },
    { d: "M8.5 15.5L6 20l3.5-1M15.5 15.5L18 20l-3.5-1" },
  ],
};

function motifSvg(motif: Motif, color: string, size: number, strokeW = 2) {
  if (motif === "aucun") return null;
  const art = MOTIF_ART[motif];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "flex" }}>
      {art.map((p, i) =>
        p.fill ? (
          <path key={i} d={p.d} fill={color} />
        ) : (
          <path
            key={i}
            d={p.d}
            fill="none"
            stroke={color}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )
      )}
    </svg>
  );
}

// Chaque personnalité typographique = une vraie police + graisse + casse.
/* ---------- texte riche (le langage des studios de design) ----------
 * [mots] → surlignés au marqueur · *mots* → serif italique · _mots_ → soulignés
 * L'IA écrit ce marquage elle-même dans ses accroches. */
type RichOpts = {
  size: number; color: string; accent: string; onAccent: string;
  weight: number; family: string; spacing: number; lineHeight: number;
  uppercase: boolean; center?: boolean;
};
function stripRich(t: string): string {
  return t.replace(/[\[\]*_|]/g, " ").replace(/\s+/g, " ").trim();
}
function richText(text: string, o: RichOpts) {
  const tokens: { w: string; kind: string }[] = [];
  const re = /\[([^\]]+)\]|\*([^*]+)\*|_([^_]+)_|([^\[\]*_]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const kind = m[1] ? "hl" : m[2] ? "serif" : m[3] ? "ul" : "plain";
    for (const w of (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").trim().split(/\s+/).filter(Boolean))
      tokens.push({ w, kind });
  }
  const base = {
    display: "flex" as const, fontSize: o.size, fontFamily: o.family,
    fontWeight: o.weight, letterSpacing: o.spacing, lineHeight: o.lineHeight, color: o.color,
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline",
      justifyContent: o.center ? "center" : "flex-start",
      columnGap: o.size * 0.24, rowGap: o.size * 0.16, maxWidth: "100%" }}>
      {tokens.map((t, i) => {
        const txt = o.uppercase && t.kind !== "serif" ? t.w.toUpperCase() : t.w;
        if (t.kind === "hl")
          return (
            <span key={i} style={{ ...base, background: o.accent, color: o.onAccent,
              padding: `${o.size * 0.01}px ${o.size * 0.16}px ${o.size * 0.09}px`,
              borderRadius: o.size * 0.09, transform: `rotate(${i % 2 ? -1.2 : 1}deg)` }}>
              {txt}
            </span>
          );
        if (t.kind === "serif")
          return (
            <span key={i} style={{ ...base, fontFamily: "Instrument Serif",
              fontWeight: 400, fontSize: o.size * 1.1 }}>
              {t.w}
            </span>
          );
        if (t.kind === "ul")
          return (
            <span key={i} style={{ ...base, borderBottom: `${Math.max(3, o.size * 0.07)}px solid ${o.accent}`,
              paddingBottom: o.size * 0.04 }}>
              {txt}
            </span>
          );
        return <span key={i} style={base}>{txt}</span>;
      })}
    </div>
  );
}

const TYPO: Record<
  BrandIdentity["typography"],
  { family: string; weight: number; spacing: number; uppercase: boolean; lineHeight: number }
> = {
  moderne: { family: "Space Grotesk", weight: 700, spacing: -1.5, uppercase: false, lineHeight: 1.02 },
  impactful: { family: "Archivo Black", weight: 400, spacing: -0.5, uppercase: true, lineHeight: 1.0 },
  elegant: { family: "Space Grotesk", weight: 300, spacing: 0.5, uppercase: false, lineHeight: 1.14 },
  technique: { family: "Space Grotesk", weight: 500, spacing: 4, uppercase: true, lineHeight: 1.08 },
};

const AUTO_STYLES: BgStyle[] = ["mesh", "diagonal", "blobs", "dots", "rings", "waves", "pattern"];

/* ---------- fonds procéduraux (chacun unique selon la graine) ---------- */
function backgroundLayers(
  style: BgStyle,
  seed: number,
  accent: string,
  accent2: string,
  dark: boolean,
  w: number,
  h: number,
  motif: Motif
) {
  const rand = rng(seed);
  const soft = dark ? 0.34 : 0.2;
  const layers: React.ReactNode[] = [];

  if (style === "mesh") {
    const spots = [
      { c: accent, a: soft },
      { c: accent2, a: soft * 0.7 },
      { c: mix(accent, accent2, 0.5), a: soft * 0.55 },
    ];
    spots.forEach((s, i) => {
      const size = h * (0.7 + rand() * 0.7);
      layers.push(
        <div
          key={`m${i}`}
          style={{
            position: "absolute",
            top: (rand() - 0.35) * h,
            left: (rand() - 0.15) * w,
            width: size,
            height: size,
            borderRadius: 9999,
            background: `radial-gradient(circle, ${rgba(s.c, s.a)} 0%, ${rgba(s.c, 0)} 65%)`,
            display: "flex",
          }}
        />
      );
    });
  } else if (style === "diagonal") {
    const angle = 18 + rand() * 20;
    [0, 1].forEach((i) => {
      layers.push(
        <div
          key={`d${i}`}
          style={{
            position: "absolute",
            top: -h * 0.5,
            left: w * (i === 0 ? 0.28 : 0.55) + rand() * w * 0.1,
            width: w * (0.16 + rand() * 0.1),
            height: h * 2,
            background: `linear-gradient(${i ? accent2 : accent}, ${rgba(i ? accent2 : accent, 0.2)})`,
            opacity: dark ? 0.5 : 0.28,
            transform: `rotate(${angle}deg)`,
            display: "flex",
          }}
        />
      );
    });
  } else if (style === "blobs") {
    for (let i = 0; i < 4; i++) {
      const size = h * (0.18 + rand() * 0.4);
      const c = [accent, accent2, mix(accent, accent2, 0.5)][i % 3];
      layers.push(
        <div
          key={`b${i}`}
          style={{
            position: "absolute",
            top: rand() * h * 0.9 - h * 0.1,
            left: rand() * w * 0.95 - w * 0.05,
            width: size,
            height: size,
            borderRadius: `${40 + rand() * 40}% ${40 + rand() * 40}% ${40 + rand() * 40}% ${40 + rand() * 40}%`,
            background: rgba(c, dark ? 0.28 : 0.16),
            display: "flex",
          }}
        />
      );
    }
  } else if (style === "dots") {
    const cols = 13;
    const rows = Math.round((h / w) * cols);
    const gapx = w / cols;
    const gapy = h / rows;
    const r = Math.max(3, w * 0.006);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        layers.push(
          <div
            key={`p${x}-${y}`}
            style={{
              position: "absolute",
              top: y * gapy + gapy / 2,
              left: x * gapx + gapx / 2,
              width: r,
              height: r,
              borderRadius: 9999,
              background: rgba(accent, dark ? 0.16 : 0.12),
              display: "flex",
            }}
          />
        );
      }
    }
    // Un halo d'accent pour réchauffer la trame.
    layers.push(
      <div
        key="dg"
        style={{
          position: "absolute",
          bottom: -h * 0.4,
          right: -w * 0.1,
          width: h,
          height: h,
          borderRadius: 9999,
          background: `radial-gradient(circle, ${rgba(accent2, soft)} 0%, ${rgba(accent2, 0)} 60%)`,
          display: "flex",
        }}
      />
    );
  } else if (style === "rings") {
    const cx = rand() > 0.5 ? w * 0.82 : w * 0.12;
    const cy = rand() > 0.5 ? h * 0.2 : h * 0.82;
    for (let i = 5; i >= 1; i--) {
      const size = h * 0.22 * i;
      layers.push(
        <div
          key={`r${i}`}
          style={{
            position: "absolute",
            top: cy - size / 2,
            left: cx - size / 2,
            width: size,
            height: size,
            borderRadius: 9999,
            border: `${Math.max(2, w * 0.0025)}px solid ${rgba(i % 2 ? accent : accent2, dark ? 0.22 : 0.16)}`,
            display: "flex",
          }}
        />
      );
    }
  } else if (style === "pattern") {
    // Papier peint : le motif répété en filigrane, légèrement incliné.
    const m: Motif = motif === "aucun" ? "coeur" : motif;
    const cols = 7;
    const rows = Math.max(4, Math.round((h / w) * cols) + 1);
    const gapx = w / cols;
    const gapy = h / rows;
    const size = Math.min(gapx, gapy) * 0.42;
    for (let y = 0; y < rows + 1; y++) {
      for (let x = 0; x < cols + 1; x++) {
        const offset = y % 2 ? gapx / 2 : 0;
        layers.push(
          <div
            key={`w${x}-${y}`}
            style={{
              position: "absolute",
              top: y * gapy + gapy / 2 - size / 2,
              left: x * gapx + offset - size / 2,
              display: "flex",
              opacity: dark ? 0.13 : 0.1,
              transform: `rotate(${(x + y) % 2 ? -12 : 12}deg)`,
            }}
          >
            {motifSvg(m, (x + y) % 3 === 0 ? accent2 : accent, size, 1.8)}
          </div>
        );
      }
    }
    layers.push(
      <div
        key="pg"
        style={{
          position: "absolute",
          top: -h * 0.3,
          right: -w * 0.12,
          width: h,
          height: h,
          borderRadius: 9999,
          background: `radial-gradient(circle, ${rgba(accent, soft * 0.8)} 0%, ${rgba(accent, 0)} 62%)`,
          display: "flex",
        }}
      />
    );
  } else if (style === "waves") {
    layers.push(
      <svg
        key="wv"
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ position: "absolute", top: 0, left: 0, display: "flex" }}
      >
        {[0, 1, 2].map((i) => {
          const base = h * (0.62 + i * 0.12) + (rand() - 0.5) * h * 0.05;
          const amp = h * (0.06 + rand() * 0.05);
          const c = [accent, accent2, mix(accent, accent2, 0.5)][i % 3];
          const d = `M0 ${base} C ${w * 0.3} ${base - amp}, ${w * 0.6} ${base + amp}, ${w} ${base - amp * 0.4} L ${w} ${h} L 0 ${h} Z`;
          return <path key={i} d={d} fill={rgba(c, dark ? 0.22 : 0.14)} />;
        })}
      </svg>
    );
  }
  return layers;
}

function render(v: VisualSpec, brand: BrandIdentity, w: number, h: number, slideIdx = 0) {
  const pool = accentPool(brand);
  const seed = v.seed ?? hashString(v.headline);
  const idx = ((v.accentIndex % pool.length) + pool.length) % pool.length;
  const accent = pool[idx];
  const accent2 = pool[(idx + 1) % pool.length];
  const dark = v.mode === "sombre";
  const style: BgStyle =
    v.bg === "auto" ? AUTO_STYLES[(seed + slideIdx) % AUTO_STYLES.length] : v.bg;
  const hasPhoto = Boolean(v.bgImage);

  const baseDark = luminance(brand.colorDark) < 0.5 ? brand.colorDark : "#0d1b2e";
  const bg = dark
    ? `linear-gradient(140deg, ${mix(baseDark, "#000000", 0.15)} 0%, ${baseDark} 45%, ${mix(baseDark, accent, 0.22)} 100%)`
    : `linear-gradient(140deg, #ffffff 0%, ${mix("#ffffff", accent, 0.05)} 55%, ${mix("#ffffff", accent, 0.11)} 100%)`;

  // Sur une photo : texte toujours clair, voile sombre pour la lisibilité.
  const ink = hasPhoto ? "#ffffff" : dark ? "#ffffff" : "#0f1720";
  const sub = hasPhoto
    ? "rgba(255,255,255,0.82)"
    : dark
      ? "rgba(255,255,255,0.66)"
      : "rgba(15,23,32,0.6)";
  const pad = Math.round(w * 0.078);
  const typo = TYPO[brand.typography] ?? TYPO.moderne;
  const cs = (t: string) => (typo.uppercase ? t.toUpperCase() : t);

  const hlen = v.headline.length;
  const headlineSize = hlen > 52 ? w * 0.058 : hlen > 32 ? w * 0.072 : w * 0.088;
  const headStyle = {
    fontFamily: typo.family,
    fontWeight: typo.weight,
    letterSpacing: typo.spacing,
    lineHeight: typo.lineHeight,
  };
  // Titre en dégradé subtil (blanc → teinte d'accent) sur fond sombre/photo :
  // donne la profondeur d'un vrai lettrage travaillé. Encre pleine en clair.
  const headlineFill =
    dark || hasPhoto
      ? {
          backgroundImage: `linear-gradient(105deg, #ffffff 35%, ${mix(accent, "#ffffff", 0.45)} 100%)`,
          backgroundClip: "text" as const,
          color: "transparent",
        }
      : { color: ink };
  // Vignette : assombrit légèrement les bords → le regard reste au centre.
  const vignette =
    dark || hasPhoto ? (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: w,
          height: h,
          background: `radial-gradient(circle at 30% 25%, rgba(0,0,0,0) 52%, rgba(0,0,0,${hasPhoto ? 0.25 : 0.32}) 100%)`,
          display: "flex",
        }}
      />
    ) : null;

  const onAccent = luminance(accent) > 0.62 ? "#171a2b" : "#ffffff";
  const rich = (text: string, size: number, center = false, family?: string) =>
    richText(text, {
      size, color: ink, accent, onAccent, weight: typo.weight,
      family: family ?? typo.family, spacing: typo.spacing,
      lineHeight: typo.lineHeight, uppercase: typo.uppercase, center,
    });

  // Barre d'accent verticale à gauche (structure), sauf en mode photo.
  const bar = !hasPhoto ? (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: Math.round(w * 0.012),
        background: `linear-gradient(180deg, ${accent} 0%, ${accent2} 100%)`,
        display: "flex",
      }}
    />
  ) : null;

  const logoBox = brand.logo ? (
    <div
      style={{
        width: w * 0.05,
        height: w * 0.05,
        borderRadius: 12,
        background: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${rgba("#000000", 0.08)}`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={brand.logo} alt="" width={w * 0.04} height={w * 0.04} style={{ objectFit: "contain" }} />
    </div>
  ) : (
    <div
      style={{
        width: w * 0.03,
        height: w * 0.03,
        borderRadius: 9,
        background: `linear-gradient(135deg, ${accent}, ${accent2})`,
        display: "flex",
      }}
    />
  );

  const wordmark = (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      {logoBox}
      <div style={{ display: "flex", fontSize: w * 0.028, fontWeight: 800, color: ink, letterSpacing: 1 }}>
        {brand.name.toUpperCase()}
      </div>
    </div>
  );

  // Badge motif en haut à droite : signe distinctif supplémentaire du post.
  const motifBadge =
    v.motif !== "aucun" && v.template !== "meme" && v.template !== "match" ? (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: w * 0.055,
          height: w * 0.055,
          borderRadius: w * 0.016,
          background: hasPhoto ? rgba("#000000", 0.35) : dark ? rgba(accent, 0.16) : rgba(accent, 0.1),
          border: `1px solid ${rgba(accent, hasPhoto ? 0.6 : 0.35)}`,
        }}
      >
        {motifSvg(v.motif, hasPhoto ? "#ffffff" : dark ? mix(accent, "#ffffff", 0.35) : accent, w * 0.034)}
      </div>
    ) : null;

  const topRow = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      {wordmark}
      {slideIdx >= 1 ? null : motifBadge}
    </div>
  );

  // ---- Carrousel : slides de contenu + slide CTA finale ----
  const slides = v.slides ?? [];
  const inCarousel = slideIdx >= 1 && slides.length > 0 && slideIdx <= slides.length + 1;
  const totalSlides = slides.length + 2; // couverture + contenu + CTA
  const progressDots = inCarousel ? (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {Array.from({ length: totalSlides }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === slideIdx ? 24 : 8,
            height: 8,
            borderRadius: 999,
            background: i === slideIdx ? accent : rgba(ink, 0.25),
            display: "flex",
          }}
        />
      ))}
    </div>
  ) : null;


  const footer = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 30, height: 4, borderRadius: 3, background: accent, display: "flex" }} />
        <div style={{ display: "flex", fontSize: w * 0.021, color: sub, fontWeight: 500 }}>{brand.tagline}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {progressDots}
        <div style={{ display: "flex", fontSize: w * 0.019, color: sub, fontWeight: 600, letterSpacing: 1 }}>
          {inCarousel && slideIdx <= slides.length ? "SUITE →" : "iOS · ANDROID"}
        </div>
      </div>
    </div>
  );

  const eyebrow = (label: string) => (
    <div
      style={{
        display: "flex",
        alignSelf: "flex-start",
        alignItems: "center",
        gap: 10,
        background: hasPhoto ? rgba(accent, 0.9) : dark ? rgba(accent, 0.16) : rgba(accent, 0.12),
        border: `1px solid ${rgba(accent, hasPhoto ? 0.9 : dark ? 0.4 : 0.3)}`,
        color: hasPhoto ? "#fff" : dark ? mix(accent, "#ffffff", 0.35) : accent,
        fontSize: w * 0.02,
        fontWeight: 800,
        letterSpacing: 2.5,
        padding: `${w * 0.01}px ${w * 0.022}px`,
        borderRadius: 999,
      }}
    >
      {label}
    </div>
  );

  const headline = (size = headlineSize) => rich(v.headline, size);

  // Découpe la subline en points pour la checklist.
  const items = v.subline
    .split(/\s*(?:·|•|\/|\n|;)\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  let body: React.ReactNode;
  if (inCarousel && slideIdx > slides.length) {
    // Slide CTA finale (le playbook : appel à l'action en dernière slide)
    body = (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: w * 0.022, width: "100%" }}>
        {stars(accent, w * 0.032)}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            textAlign: "center",
            fontSize: headlineSize,
            ...headlineFill,
            ...headStyle,
            maxWidth: "90%",
          }}
        >
          {cs(`Installe ${brand.name}`)}
        </div>
        <div style={{ display: "flex", fontSize: w * 0.026, color: sub, fontWeight: 500, textAlign: "center" }}>
          Gratuit sur l&apos;App Store &amp; Google Play
        </div>
        <div
          style={{
            display: "flex",
            background: `linear-gradient(135deg, ${accent}, ${mix(accent, accent2, 0.7)})`,
            color: "#ffffff",
            fontSize: w * 0.024,
            fontWeight: 700,
            padding: `${w * 0.014}px ${w * 0.04}px`,
            borderRadius: 999,
            marginTop: w * 0.008,
          }}
        >
          Lien en bio →
        </div>
      </div>
    );
  } else if (inCarousel) {
    // Slide de contenu : UNE idée, numérotée, lisible en 1 seconde
    const sl = slides[slideIdx - 1];
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: w * 0.02, maxWidth: "92%" }}>
        <div
          style={{
            display: "flex",
            fontSize: w * 0.085,
            fontFamily: typo.family,
            fontWeight: 700,
            color: accent,
            lineHeight: 1,
          }}
        >
          {String(slideIdx + 1).padStart(2, "0")}
        </div>
        {rich(sl.headline, headlineSize * 0.72)}
        {sl.subline ? (
          <div style={{ display: "flex", fontSize: w * 0.028, color: sub, lineHeight: 1.35, fontWeight: 500 }}>
            {sl.subline}
          </div>
        ) : null}
      </div>
    );
  } else if (v.template === "astuce") {
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: w * 0.022, maxWidth: "90%" }}>
        {eyebrow("ASTUCE")}
        {headline()}
        {v.subline ? (
          <div style={{ display: "flex", fontSize: w * 0.027, color: sub, lineHeight: 1.35, fontWeight: 500 }}>
            {v.subline}
          </div>
        ) : null}
      </div>
    );
  } else if (v.template === "stat") {
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: w * 0.012, maxWidth: "92%" }}>
        <div
          style={{
            display: "flex",
            fontSize: w * 0.2,
            fontWeight: 900,
            color: hasPhoto ? "#fff" : accent,
            lineHeight: 0.92,
            letterSpacing: -4,
          }}
        >
          {stripRich(v.headline)}
        </div>
        {v.subline ? (
          <div style={{ display: "flex", fontSize: w * 0.036, fontWeight: 700, color: ink, lineHeight: 1.15, maxWidth: "80%" }}>
            {v.subline}
          </div>
        ) : null}
      </div>
    );
  } else if (v.template === "citation") {
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: w * 0.01, maxWidth: "88%" }}>
        <div style={{ display: "flex", fontSize: w * 0.14, fontWeight: 900, color: accent, lineHeight: 0.5 }}>“</div>
        {rich(v.headline, headlineSize * 0.9)}
        {v.subline ? (
          <div style={{ display: "flex", fontSize: w * 0.024, color: sub, fontWeight: 600, marginTop: w * 0.01 }}>
            — {v.subline}
          </div>
        ) : null}
      </div>
    );
  } else if (v.template === "duo") {
    body = (
      <div style={{ display: "flex", alignItems: "center", gap: w * 0.04, maxWidth: "100%" }}>
        <div style={{ display: "flex", width: w * 0.012, alignSelf: "stretch", background: accent, borderRadius: 4 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: w * 0.02, flex: 1 }}>
          {headline(headlineSize * 0.92)}
          {v.subline ? (
            <div style={{ display: "flex", fontSize: w * 0.028, color: sub, lineHeight: 1.35, fontWeight: 500 }}>
              {v.subline}
            </div>
          ) : null}
        </div>
      </div>
    );
  } else if (v.template === "checklist") {
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: w * 0.022, maxWidth: "92%" }}>
        {headline(headlineSize * 0.82)}
        <div style={{ display: "flex", flexDirection: "column", gap: w * 0.016 }}>
          {(items.length ? items : ["Profils vérifiés", "Matching par affinités", "Sans mauvaise surprise"]).map(
            (it, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: w * 0.016 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: w * 0.038,
                    height: w * 0.038,
                    borderRadius: 9999,
                    background: rgba(accent, dark || hasPhoto ? 0.2 : 0.14),
                  }}
                >
                  <svg width={w * 0.022} height={w * 0.022} viewBox="0 0 24 24" style={{ display: "flex" }}>
                    <path d={CHECK_PATH} stroke={accent} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ display: "flex", fontSize: w * 0.03, color: ink, fontWeight: 600 }}>{it}</div>
              </div>
            )
          )}
        </div>
      </div>
    );
  } else if (v.template === "punch") {
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: w * 0.02, maxWidth: "94%", alignItems: "flex-start" }}>
        {rich(v.headline, headlineSize * 1.15)}
        <div style={{ display: "flex", width: w * 0.14, height: w * 0.014, borderRadius: 8, background: accent }} />
        {v.subline ? (
          <div style={{ display: "flex", fontSize: w * 0.03, color: sub, fontWeight: 500, lineHeight: 1.3 }}>
            {v.subline}
          </div>
        ) : null}
      </div>
    );
  } else if (v.template === "temoignage") {
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: w * 0.02, maxWidth: "88%" }}>
        {stars(hasPhoto ? "#fff" : accent, w * 0.034)}
        {rich(v.headline, headlineSize * 0.88)}
        {v.subline ? (
          <div style={{ display: "flex", fontSize: w * 0.024, color: sub, fontWeight: 600 }}>— {v.subline}</div>
        ) : null}
      </div>
    );
  } else if (v.template === "meme") {
    // Meme : motif géant en badge + texte choc centré — l'énergie d'un meme,
    // dans la charte.
    const m: Motif = v.motif === "aucun" ? "eclair" : v.motif;
    const compact = v.headline.length > 40;
    const badge = w * (compact ? 0.11 : 0.15);
    body = (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: w * 0.024, width: "100%" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: badge,
            height: badge,
            borderRadius: badge * 0.3,
            background: `linear-gradient(135deg, ${accent}, ${mix(accent, accent2, 0.75)})`,
            transform: "rotate(-5deg)",
          }}
        >
          {motifSvg(m, "#ffffff", badge * 0.6, 2.2)}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            textAlign: "center",
            fontSize: headlineSize * (compact ? 0.82 : 0.95),
            ...headlineFill,
            fontFamily: typo.family,
            fontWeight: typo.weight,
            letterSpacing: -1,
            lineHeight: 1.02,
            maxWidth: "92%",
          }}
        >
          {v.headline.toUpperCase()}
        </div>
        {v.subline ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              textAlign: "center",
              fontSize: w * 0.027,
              color: sub,
              fontWeight: 600,
              maxWidth: "80%",
            }}
          >
            {v.subline}
          </div>
        ) : null}
      </div>
    );
  } else if (v.template === "match") {
    // Carte de match façon UI de l'app : deux profils + compatibilité + tags.
    const names = stripRich(v.headline)
      .split(/\s*(?:\+|&|\bet\b)\s*/i)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 2);
    const n1 = names[0] || "Léa";
    const n2 = names[1] || "Tom";
    const pct = (v.subline.match(/\d+\s*%/) || ["92 %"])[0];
    const chips = v.subline
      .split(/\s*[·•]\s*/)
      .map((s) => s.trim())
      .filter((s) => s && !s.includes("%"))
      .slice(0, 3);
    const cardBg = dark || hasPhoto ? rgba("#ffffff", 0.08) : "#ffffff";
    const avatar = (name: string, c: string) => (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: w * 0.085,
            height: w * 0.085,
            borderRadius: 9999,
            background: `linear-gradient(135deg, ${c}, ${mix(c, "#ffffff", 0.35)})`,
            color: "#ffffff",
            fontSize: w * 0.038,
            fontWeight: 800,
          }}
        >
          {name.slice(0, 1).toUpperCase()}
        </div>
        <div style={{ display: "flex", fontSize: w * 0.021, fontWeight: 700, color: ink }}>{name}</div>
      </div>
    );
    body = (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: w * 0.02,
            background: cardBg,
            border: `1px solid ${rgba(ink, 0.12)}`,
            borderRadius: 28,
            padding: `${w * 0.028}px ${w * 0.05}px`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: w * 0.035 }}>
            {avatar(n1, accent)}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: w * 0.052,
                height: w * 0.052,
                borderRadius: 9999,
                background: accent2,
              }}
            >
              {motifSvg("coeur", "#ffffff", w * 0.03)}
            </div>
            {avatar(n2, accent2)}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: rgba(accent, 0.14),
              border: `1px solid ${rgba(accent, 0.32)}`,
              color: dark || hasPhoto ? mix(accent, "#ffffff", 0.4) : accent,
              borderRadius: 999,
              padding: `${w * 0.008}px ${w * 0.022}px`,
              fontSize: w * 0.024,
              fontWeight: 800,
            }}
          >
            {pct} compatibles
          </div>
          {chips.length ? (
            <div style={{ display: "flex", gap: 10 }}>
              {chips.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    fontSize: w * 0.017,
                    fontWeight: 600,
                    color: sub,
                    border: `1px solid ${rgba(ink, 0.16)}`,
                    borderRadius: 999,
                    padding: `${w * 0.006}px ${w * 0.016}px`,
                  }}
                >
                  {c}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  } else if (v.template === "app") {
    // Vitrine produit : mockup téléphone montrant un match dans l'app —
    // le visuel a un SUJET, pas seulement du texte.
    const phoneW = Math.min(w * 0.23, (h * 0.72) / 1.95);
    const phoneH = phoneW * 1.95;
    const cardBg = "#ffffff";
    const nameBar = (width: number, c: string) => (
      <div style={{ display: "flex", width, height: phoneW * 0.045, borderRadius: 999, background: c }} />
    );
    const phone = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: phoneW,
          height: phoneH,
          borderRadius: phoneW * 0.16,
          background: mix(brand.colorDark, "#000000", 0.35),
          border: `${Math.max(3, phoneW * 0.02)}px solid ${rgba("#ffffff", dark ? 0.25 : 0.65)}`,
          padding: phoneW * 0.05,
          transform: "rotate(4deg)",
        }}
      >
        {/* écran */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            flex: 1,
            borderRadius: phoneW * 0.11,
            background: `linear-gradient(170deg, ${mix("#ffffff", accent, 0.06)} 0%, ${mix("#ffffff", accent, 0.16)} 100%)`,
            padding: phoneW * 0.07,
            gap: phoneW * 0.06,
          }}
        >
          {/* encoche */}
          <div style={{ display: "flex", width: phoneW * 0.3, height: phoneW * 0.035, borderRadius: 999, background: rgba("#000000", 0.25) }} />
          {/* carte de match */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: phoneW * 0.05,
              width: "100%",
              background: cardBg,
              borderRadius: phoneW * 0.09,
              padding: `${phoneW * 0.08}px ${phoneW * 0.06}px`,
              border: `1px solid ${rgba("#0f1720", 0.08)}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: phoneW * 0.06 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: phoneW * 0.24, height: phoneW * 0.24, borderRadius: 9999, background: `linear-gradient(135deg, ${accent}, ${mix(accent, "#ffffff", 0.35)})`, color: "#fff", fontSize: phoneW * 0.11, fontWeight: 700 }}>L</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: phoneW * 0.13, height: phoneW * 0.13, borderRadius: 9999, background: accent2 }}>
                {motifSvg("coeur", "#ffffff", phoneW * 0.075)}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: phoneW * 0.24, height: phoneW * 0.24, borderRadius: 9999, background: `linear-gradient(135deg, ${accent2}, ${mix(accent2, "#ffffff", 0.35)})`, color: "#fff", fontSize: phoneW * 0.11, fontWeight: 700 }}>T</div>
            </div>
            <div style={{ display: "flex", background: rgba(accent, 0.13), border: `1px solid ${rgba(accent, 0.3)}`, color: accent, borderRadius: 999, padding: `${phoneW * 0.02}px ${phoneW * 0.06}px`, fontSize: phoneW * 0.085, fontWeight: 700 }}>
              93 % compatibles
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: phoneW * 0.03, alignItems: "center" }}>
              {nameBar(phoneW * 0.5, rgba("#0f1720", 0.15))}
              {nameBar(phoneW * 0.34, rgba("#0f1720", 0.1))}
            </div>
            <div style={{ display: "flex", width: "100%", justifyContent: "center", background: `linear-gradient(135deg, ${accent}, ${mix(accent, accent2, 0.6)})`, color: "#ffffff", borderRadius: 999, padding: phoneW * 0.045, fontSize: phoneW * 0.075, fontWeight: 700 }}>
              Matcher
            </div>
          </div>
        </div>
      </div>
    );
    body = (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: w * 0.02, maxWidth: "52%" }}>
          {eyebrow("DANS L'APP")}
          <div style={{ display: "flex", fontSize: headlineSize * 0.8, ...headlineFill, ...headStyle }}>
            {cs(v.headline)}
          </div>
          {v.subline ? (
            <div style={{ display: "flex", fontSize: w * 0.026, color: sub, lineHeight: 1.35, fontWeight: 500 }}>
              {v.subline}
            </div>
          ) : null}
        </div>
        {phone}
      </div>
    );
  } else if (v.template === "editorial") {
    // Éditorial : lignes à échelles contrastées (sans-serif black ↔ serif
    // italique) + annotations satellites — le langage des studios de design.
    const lines = v.headline.split(/\s*\|\s*/).filter(Boolean);
    const notes = v.subline.split(/\s*[·•]\s*/).map((t) => t.trim()).filter(Boolean).slice(0, 3);
    const note = (t: string, align: "flex-start" | "flex-end" | "center") => (
      <div style={{ display: "flex", alignSelf: align, alignItems: "center", gap: 8,
        fontSize: w * 0.019, color: sub, fontWeight: 600 }}>
        <div style={{ width: 6, height: 6, borderRadius: 999, background: accent, display: "flex" }} />
        {t}
      </div>
    );
    body = (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: w * 0.02, width: "100%" }}>
        {notes[0] ? note(notes[0], "flex-start") : null}
        {(lines.length ? lines : [v.headline]).map((ln, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "center", maxWidth: "94%" }}>
            {richText(ln, {
              size: headlineSize * (i % 2 ? 0.6 : 0.98),
              color: ink, accent, onAccent,
              weight: i % 2 ? 400 : 700,
              family: i % 2 ? "Instrument Serif" : typo.family,
              spacing: i % 2 ? 0 : typo.spacing,
              lineHeight: 1.06,
              uppercase: i % 2 ? false : true,
              center: true,
            })}
          </div>
        ))}
        {notes[1] ? note(notes[1], "flex-end") : null}
        {notes[2] ? note(notes[2], "center") : null}
      </div>
    );
  } else {
    // annonce
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: w * 0.02, maxWidth: "90%" }}>
        {eyebrow("NOUVEAU")}
        {headline()}
        {v.subline ? (
          <div style={{ display: "flex", fontSize: w * 0.028, color: sub, lineHeight: 1.35, fontWeight: 500 }}>
            {v.subline}
          </div>
        ) : null}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: w * 0.008 }}>
          {stars(hasPhoto ? "#fff" : accent, w * 0.026)}
          <div style={{ display: "flex", fontSize: w * 0.019, color: sub, fontWeight: 600 }}>
            Gratuit sur l&apos;App Store &amp; Google Play
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: bg,
        padding: pad,
        paddingLeft: hasPhoto ? pad : pad + w * 0.012,
        position: "relative",
        fontFamily: '"Space Grotesk", sans-serif',
      }}
    >
      {/* Créa 100 % IA : l'image EST le post, aucun habillage par-dessus */}
      {hasPhoto && v.template === "ia" ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={v.bgImage as string} alt="" width={w} height={h}
          style={{ position: "absolute", top: 0, left: 0, width: w, height: h, objectFit: "cover", display: "flex" }} />
      ) : hasPhoto ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={v.bgImage as string}
            alt=""
            width={w}
            height={h}
            style={{ position: "absolute", top: 0, left: 0, width: w, height: h, objectFit: "cover", display: "flex" }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: w,
              height: h,
              background: `linear-gradient(160deg, ${rgba(baseDark, 0.35)} 0%, ${rgba(baseDark, 0.55)} 55%, ${rgba(baseDark, 0.82)} 100%)`,
              display: "flex",
            }}
          />
        </>
      ) : (
        backgroundLayers(style, seed, accent, accent2, dark, w, h, v.motif)
      )}
      {vignette}
      {v.template === "ia" && hasPhoto ? null : bar}
      {v.template === "ia" && hasPhoto ? null : topRow}
      {v.template === "ia" && hasPhoto ? null : body}
      {v.template === "ia" && hasPhoto ? null : footer}
    </div>
  );
}
