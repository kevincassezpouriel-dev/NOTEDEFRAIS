import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBrand } from "@/lib/brand";
import { parseVisual, type VisualSpec } from "@/lib/visual";
import type { BrandIdentity } from "@/lib/brand";

export const dynamic = "force-dynamic";

/**
 * Moteur de composition visuelle : rend l'image de marque d'un post
 * (spec visuelle décidée par l'IA ou éditée dans l'admin) aux couleurs de
 * l'identité — palette verrouillée, gabarits fixes, zéro divergence.
 *
 *   /api/og/{slug}            → 1200×630 (partages Facebook/LinkedIn/X, og:image)
 *   /api/og/{slug}?format=carre → 1080×1080 (Instagram)
 *
 * Endpoint public : les scrapers des réseaux doivent pouvoir le lire.
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
    select: { title: true, visual: true, status: true },
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

// La typographie choisie dans l'identité pilote graisse / casse / interlettrage
// des titres du visuel (rendu robuste, sans police externe à charger).
const TYPO: Record<
  BrandIdentity["typography"],
  { weight: number; spacing: number; uppercase: boolean; lineHeight: number }
> = {
  moderne: { weight: 800, spacing: -0.5, uppercase: false, lineHeight: 1.08 },
  impactful: { weight: 900, spacing: -1, uppercase: true, lineHeight: 1.0 },
  elegant: { weight: 600, spacing: 0.3, uppercase: false, lineHeight: 1.2 },
  technique: { weight: 700, spacing: 1.5, uppercase: true, lineHeight: 1.12 },
};

function render(v: VisualSpec, brand: BrandIdentity, w: number, h: number) {
  const accent = v.accent === "secondaire" ? brand.colorSecondary : brand.colorPrimary;
  const dark = v.mode === "sombre";
  const bg = dark ? brand.colorDark : "#faf9f6";
  const ink = dark ? "#ffffff" : "#101418";
  const sub = dark ? "rgba(255,255,255,0.72)" : "rgba(16,20,24,0.65)";
  const pad = Math.round(w * 0.075);
  const typo = TYPO[brand.typography] ?? TYPO.moderne;
  const headlineSize = v.headline.length > 46 ? w * 0.055 : v.headline.length > 26 ? w * 0.068 : w * 0.082;
  const cs = (t: string) => (typo.uppercase ? t.toUpperCase() : t);
  const headStyle = {
    fontWeight: typo.weight,
    letterSpacing: typo.spacing,
    lineHeight: typo.lineHeight,
  };

  const wordmark = (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      {brand.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logo} alt="" width={40} height={40} style={{ borderRadius: 8 }} />
      ) : (
        <div style={{ width: 26, height: 26, background: accent, borderRadius: 7, display: "flex" }} />
      )}
      <div style={{ display: "flex", fontSize: w * 0.026, fontWeight: 700, color: ink, letterSpacing: 2 }}>
        {brand.name.toUpperCase()}
      </div>
    </div>
  );

  const footer = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      <div style={{ display: "flex", fontSize: w * 0.019, color: sub }}>{brand.tagline}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ width: 44, height: 8, background: accent, borderRadius: 4, display: "flex" }} />
        <div style={{ width: 16, height: 8, background: sub, borderRadius: 4, display: "flex", opacity: 0.5 }} />
      </div>
    </div>
  );

  // Décor géométrique de marque (jamais d'images externes : fiable partout)
  const decor = (
    <div
      style={{
        position: "absolute",
        right: -h * 0.22,
        top: -h * 0.22,
        width: h * 0.62,
        height: h * 0.62,
        borderRadius: 9999,
        background: accent,
        opacity: dark ? 0.22 : 0.14,
        display: "flex",
      }}
    />
  );
  const decor2 = (
    <div
      style={{
        position: "absolute",
        right: h * 0.1,
        top: h * 0.14,
        width: h * 0.16,
        height: h * 0.16,
        borderRadius: 9999,
        border: `6px solid ${accent}`,
        opacity: dark ? 0.5 : 0.35,
        display: "flex",
      }}
    />
  );

  let body;
  if (v.template === "astuce") {
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 26, maxWidth: "88%" }}>
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            background: accent,
            color: "#ffffff",
            fontSize: w * 0.022,
            fontWeight: 700,
            letterSpacing: 3,
            padding: "10px 22px",
            borderRadius: 999,
          }}
        >
          ASTUCE
        </div>
        <div style={{ display: "flex", fontSize: headlineSize, color: ink, ...headStyle }}>
          {cs(v.headline)}
        </div>
        {v.subline ? (
          <div style={{ display: "flex", fontSize: w * 0.026, color: sub, lineHeight: 1.35 }}>{v.subline}</div>
        ) : null}
      </div>
    );
  } else if (v.template === "stat") {
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: "88%" }}>
        <div style={{ display: "flex", fontSize: headlineSize * 1.5, fontWeight: 900, color: accent, lineHeight: 1 }}>
          {v.headline}
        </div>
        {v.subline ? (
          <div style={{ display: "flex", fontSize: w * 0.032, fontWeight: 600, color: ink, lineHeight: 1.25 }}>
            {v.subline}
          </div>
        ) : null}
      </div>
    );
  } else if (v.template === "citation") {
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: "86%" }}>
        <div style={{ display: "flex", fontSize: w * 0.12, fontWeight: 800, color: accent, lineHeight: 0.6 }}>«</div>
        <div style={{ display: "flex", fontSize: headlineSize * 0.92, color: ink, ...headStyle }}>
          {v.headline}
        </div>
        {v.subline ? (
          <div style={{ display: "flex", fontSize: w * 0.024, color: sub }}>— {v.subline}</div>
        ) : null}
      </div>
    );
  } else {
    // annonce
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: "88%" }}>
        <div style={{ display: "flex", width: 76, height: 12, background: accent, borderRadius: 6 }} />
        <div style={{ display: "flex", fontSize: headlineSize, color: ink, ...headStyle }}>
          {cs(v.headline)}
        </div>
        {v.subline ? (
          <div style={{ display: "flex", fontSize: w * 0.027, color: sub, lineHeight: 1.35 }}>{v.subline}</div>
        ) : null}
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
        position: "relative",
        fontFamily: "sans-serif",
      }}
    >
      {decor}
      {decor2}
      {wordmark}
      {body}
      {footer}
    </div>
  );
}
