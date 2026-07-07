"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

/**
 * Génération du QR code côté navigateur (librairie open source `qrcode`).
 * Le contenu encodé est l'URL de redirection /r/{slug} : elle ne change
 * jamais, seules les destinations sont modifiées dans l'admin.
 * Niveau de correction d'erreur H (30 %) pour tolérer le logo central.
 */

const PREVIEW_SIZE = 280;
const EXPORT_SIZE = 2048; // ~17 cm à 300 dpi : confortable pour un flyer
const LOGO_RATIO = 0.24;

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function drawQr(
  canvas: HTMLCanvasElement,
  url: string,
  size: number,
  logo: string | null
) {
  await QRCode.toCanvas(canvas, url, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: size,
    color: { dark: "#000000", light: "#ffffff" },
  });
  if (!logo) return;
  const img = await loadImage(logo);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const box = size * LOGO_RATIO;
  const pad = box * 0.14;
  const outer = box + pad * 2;
  const start = (size - outer) / 2;

  // Pastille blanche arrondie derrière le logo
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(start, start, outer, outer, pad);
  ctx.fill();

  // Logo en « contain » (proportions conservées)
  const scale = Math.min(box / img.width, box / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
}

function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function QrDesigner({
  slug,
  logo,
}: {
  slug: string;
  logo: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(process.env.NEXT_PUBLIC_APP_BASE_URL || window.location.origin);
  }, []);

  const url = origin ? `${origin.replace(/\/+$/, "")}/r/${slug}` : "";

  useEffect(() => {
    if (!url || !canvasRef.current) return;
    drawQr(canvasRef.current, url, PREVIEW_SIZE, logo).catch(console.error);
  }, [url, logo]);

  const downloadPng = useCallback(async () => {
    const canvas = document.createElement("canvas");
    await drawQr(canvas, url, EXPORT_SIZE, logo);
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `qr-${slug}.png`);
    }, "image/png");
  }, [url, slug, logo]);

  const downloadSvg = useCallback(async () => {
    let svg = await QRCode.toString(url, {
      type: "svg",
      errorCorrectionLevel: "H",
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });
    if (logo) {
      const m = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?)/);
      const n = m ? parseFloat(m[1]) : 0;
      if (n > 0) {
        const box = n * LOGO_RATIO;
        const pad = box * 0.14;
        const outer = box + pad * 2;
        const start = (n - outer) / 2;
        const inner = (n - box) / 2;
        const overlay =
          `<rect x="${start}" y="${start}" width="${outer}" height="${outer}" rx="${pad}" fill="#ffffff"/>` +
          `<image href="${logo}" x="${inner}" y="${inner}" width="${box}" height="${box}" preserveAspectRatio="xMidYMid meet"/>`;
        svg = svg.replace("</svg>", `${overlay}</svg>`);
      }
    }
    downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `qr-${slug}.svg`);
  }, [url, slug, logo]);

  async function copyUrl() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="p-3 rounded-xl" style={{ background: "#ffffff" }}>
        <canvas
          ref={canvasRef}
          width={PREVIEW_SIZE}
          height={PREVIEW_SIZE}
          className="block"
          aria-label={`QR code pour ${url}`}
        />
      </div>
      <div className="text-center">
        <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
          Contenu encodé (permanent) :
        </p>
        <button
          onClick={copyUrl}
          className="text-sm font-mono underline break-all"
          title="Copier l'URL"
        >
          {copied ? "✓ Copié !" : url}
        </button>
      </div>
      <div className="flex gap-2">
        <button onClick={downloadPng} className="btn btn-primary">
          ⬇ PNG (impression)
        </button>
        <button onClick={downloadSvg} className="btn btn-secondary">
          ⬇ SVG (vectoriel)
        </button>
      </div>
      <p className="text-xs text-center max-w-xs" style={{ color: "var(--text-muted)" }}>
        PNG exporté en 2048 × 2048 px (~17 cm à 300 dpi). Le SVG est vectoriel :
        redimensionnable à l&apos;infini pour l&apos;imprimeur.
      </p>
    </div>
  );
}
