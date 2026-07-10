import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBrand } from "@/lib/brand";
import { parseVisual, type VisualSpec } from "@/lib/visual";
import type { BrandIdentity } from "@/lib/brand";

export const dynamic = "force-dynamic";

/**
 * Moteur de composition visuelle : rend le visuel de marque d'un post
 * (spec visuelle décidée par l'IA ou éditée dans l'admin) aux couleurs, au
 * logo et à la typographie de l'identité — charte verrouillée, zéro divergence.
 *
 *   /api/og/{slug}              → 1200×630 (partages, og:image)
 *   /api/og/{slug}?format=carre → 1080×1080 (Instagram)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const square = req.nextUrl.searchParams.get("format") === "carre";
  const width = square ? 1080 : 1200;
  const height = square ? 1080 : 630;

  const post = await prisma.post.findUnique({
    where: { slug },
    select: { title: true, visual: true },
  });
  if (!post) return new Response("Introuvable", { status: 404 });

  const brand = await getBrand();
  const visual = parseVisual(post.visual, post.title);

  return new ImageResponse(render(visual, brand, width, height), {
    width,
    height,
    headers: { "Cache-Control": "public, max-age=300" },
  });
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

const STAR_PATH =
  "M12 2l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.77l-5.88 3.09 1.12-6.55L2.48 8.92l6.58-.96z";

// 5 étoiles vectorielles (le glyphe ★ n'existe pas dans la police par défaut).
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

// La typographie choisie pilote graisse / casse / interlettrage des titres.
const TYPO: Record<
  BrandIdentity["typography"],
  { weight: number; spacing: number; uppercase: boolean; lineHeight: number }
> = {
  moderne: { weight: 800, spacing: -1.5, uppercase: false, lineHeight: 1.02 },
  impactful: { weight: 900, spacing: -2, uppercase: true, lineHeight: 0.98 },
  elegant: { weight: 600, spacing: -0.2, uppercase: false, lineHeight: 1.12 },
  technique: { weight: 800, spacing: 2, uppercase: true, lineHeight: 1.05 },
};

function render(v: VisualSpec, brand: BrandIdentity, w: number, h: number) {
  const accent = v.accent === "secondaire" ? brand.colorSecondary : brand.colorPrimary;
  const accent2 = v.accent === "secondaire" ? brand.colorPrimary : brand.colorSecondary;
  const dark = v.mode === "sombre";

  // Fond dégradé subtil, teinté vers l'accent — jamais plat.
  const baseDark = luminance(brand.colorDark) < 0.5 ? brand.colorDark : "#0d1b2e";
  const bg = dark
    ? `linear-gradient(140deg, ${mix(baseDark, "#000000", 0.15)} 0%, ${baseDark} 45%, ${mix(baseDark, accent, 0.22)} 100%)`
    : `linear-gradient(140deg, #ffffff 0%, ${mix("#ffffff", accent, 0.05)} 55%, ${mix("#ffffff", accent, 0.11)} 100%)`;
  const ink = dark ? "#ffffff" : "#0f1720";
  const sub = dark ? "rgba(255,255,255,0.66)" : "rgba(15,23,32,0.6)";
  const pad = Math.round(w * 0.078);
  const typo = TYPO[brand.typography] ?? TYPO.moderne;
  const cs = (t: string) => (typo.uppercase ? t.toUpperCase() : t);

  const hlen = v.headline.length;
  const headlineSize = hlen > 52 ? w * 0.058 : hlen > 32 ? w * 0.072 : w * 0.088;
  const headStyle = {
    fontWeight: typo.weight,
    letterSpacing: typo.spacing,
    lineHeight: typo.lineHeight,
  };

  // Halo lumineux (radial) — donne de la profondeur.
  const glow = (
    <div
      style={{
        position: "absolute",
        top: -h * 0.35,
        right: -h * 0.2,
        width: h * 1.1,
        height: h * 1.1,
        borderRadius: 9999,
        background: `radial-gradient(circle, ${rgba(accent, dark ? 0.38 : 0.22)} 0%, ${rgba(accent, 0)} 62%)`,
        display: "flex",
      }}
    />
  );
  const glow2 = (
    <div
      style={{
        position: "absolute",
        bottom: -h * 0.4,
        left: -h * 0.3,
        width: h * 0.95,
        height: h * 0.95,
        borderRadius: 9999,
        background: `radial-gradient(circle, ${rgba(accent2, dark ? 0.2 : 0.12)} 0%, ${rgba(accent2, 0)} 60%)`,
        display: "flex",
      }}
    />
  );

  // Barre d'accent verticale à gauche (structure).
  const bar = (
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
  );

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
        border: `1px solid ${rgba(ink, 0.08)}`,
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

  const footer = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 30, height: 4, borderRadius: 3, background: accent, display: "flex" }} />
        <div style={{ display: "flex", fontSize: w * 0.021, color: sub, fontWeight: 500 }}>{brand.tagline}</div>
      </div>
      <div style={{ display: "flex", fontSize: w * 0.019, color: sub, fontWeight: 600, letterSpacing: 1 }}>
        iOS · ANDROID
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
        background: dark ? rgba(accent, 0.16) : rgba(accent, 0.12),
        border: `1px solid ${rgba(accent, dark ? 0.4 : 0.3)}`,
        color: dark ? mix(accent, "#ffffff", 0.35) : accent,
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

  let body;
  if (v.template === "astuce") {
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: w * 0.022, maxWidth: "90%" }}>
        {eyebrow("ASTUCE")}
        <div style={{ display: "flex", fontSize: headlineSize, color: ink, ...headStyle }}>{cs(v.headline)}</div>
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
            color: accent,
            lineHeight: 0.92,
            letterSpacing: -4,
          }}
        >
          {v.headline}
        </div>
        {v.subline ? (
          <div
            style={{
              display: "flex",
              fontSize: w * 0.036,
              fontWeight: 700,
              color: ink,
              lineHeight: 1.15,
              maxWidth: "80%",
            }}
          >
            {v.subline}
          </div>
        ) : null}
      </div>
    );
  } else if (v.template === "citation") {
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: w * 0.01, maxWidth: "88%" }}>
        <div style={{ display: "flex", fontSize: w * 0.14, fontWeight: 900, color: accent, lineHeight: 0.5 }}>“</div>
        <div style={{ display: "flex", fontSize: headlineSize * 0.9, color: ink, ...headStyle, lineHeight: 1.1 }}>
          {v.headline}
        </div>
        {v.subline ? (
          <div style={{ display: "flex", fontSize: w * 0.024, color: sub, fontWeight: 600, marginTop: w * 0.01 }}>
            — {v.subline}
          </div>
        ) : null}
      </div>
    );
  } else {
    // annonce : eyebrow + gros titre + preuve sociale
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: w * 0.02, maxWidth: "90%" }}>
        {eyebrow("NOUVEAU")}
        <div style={{ display: "flex", fontSize: headlineSize, color: ink, ...headStyle }}>{cs(v.headline)}</div>
        {v.subline ? (
          <div style={{ display: "flex", fontSize: w * 0.028, color: sub, lineHeight: 1.35, fontWeight: 500 }}>
            {v.subline}
          </div>
        ) : null}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: w * 0.008 }}>
          {stars(accent, w * 0.026)}
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
        paddingLeft: pad + w * 0.012,
        position: "relative",
        fontFamily: "sans-serif",
      }}
    >
      {glow}
      {glow2}
      {bar}
      {wordmark}
      {body}
      {footer}
    </div>
  );
}
