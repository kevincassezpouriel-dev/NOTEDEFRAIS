"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import QrDesigner from "@/components/QrDesigner";
import TrackedLink from "@/components/TrackedLink";

interface QrDetail {
  id: string;
  name: string;
  slug: string;
  type: string;
  channel: string | null;
  appStoreUrl: string;
  playStoreUrl: string;
  fallbackUrl: string;
  logo: string | null;
  active: boolean;
  totalScans: number;
  totalConversions: number;
}

/** Redimensionne le logo en ≤ 512 px et le convertit en data-URL PNG. */
async function fileToLogoDataUrl(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const max = 512;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

export default function QrDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [qr, setQr] = useState<QrDetail | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/qrcodes/${id}`, { cache: "no-store" });
    if (res.ok) setQr(await res.json());
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(data: Partial<QrDetail>) {
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/admin/qrcodes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) {
      setQr({ ...(qr as QrDetail), ...(await res.json()) });
      setMessage({ text: "✓ Enregistré — le QR code imprimé reste valable.", error: false });
    } else {
      const body = await res.json().catch(() => null);
      setMessage({ text: body?.error ?? "Erreur d'enregistrement", error: true });
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!qr) return;
    await patch({
      name: qr.name,
      channel: qr.channel,
      appStoreUrl: qr.appStoreUrl,
      playStoreUrl: qr.playStoreUrl,
      fallbackUrl: qr.fallbackUrl,
    });
  }

  async function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const logo = await fileToLogoDataUrl(file);
      await patch({ logo });
    } catch {
      setMessage({ text: "Impossible de lire cette image", error: true });
    }
  }

  async function remove() {
    if (!qr) return;
    const ok = window.confirm(
      `Supprimer « ${qr.name} » et ses ${qr.totalScans} scans ? Cette action est irréversible et le QR code imprimé cessera de fonctionner.`
    );
    if (!ok) return;
    const res = await fetch(`/api/admin/qrcodes/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/qrcodes");
  }

  if (!qr) {
    return <p className="text-sm" style={{ color: "var(--text-muted)" }}>Chargement…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/admin/qrcodes" className="text-sm" style={{ color: "var(--text-muted)" }}>
          ← QR codes
        </Link>
        <h1 className="text-xl font-semibold">{qr.name}</h1>
        <span className="text-sm ml-auto" style={{ color: "var(--text-secondary)" }}>
          {qr.totalScans.toLocaleString("fr-FR")} scans ·{" "}
          {qr.totalConversions.toLocaleString("fr-FR")} conversions
        </span>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {/* Édition des destinations */}
        <form onSubmit={save} className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold">
            Destinations{" "}
            <span className="font-normal" style={{ color: "var(--text-muted)" }}>
              — modifiables sans réimprimer le QR code
            </span>
          </h2>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1" htmlFor="f-name">Nom</label>
              <input
                id="f-name"
                className="input"
                value={qr.name}
                onChange={(e) => setQr({ ...qr, name: e.target.value })}
                required
              />
            </div>
            <div className="w-36">
              <label className="block text-xs font-medium mb-1" htmlFor="f-channel">Canal</label>
              <input
                id="f-channel"
                className="input"
                placeholder="instagram…"
                value={qr.channel ?? ""}
                onChange={(e) => setQr({ ...qr, channel: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" htmlFor="f-appstore">
              Lien App Store (iPhone / iPad)
            </label>
            <input
              id="f-appstore"
              className="input"
              type="url"
              placeholder="https://apps.apple.com/fr/app/votre-app/id0000000000"
              value={qr.appStoreUrl}
              onChange={(e) => setQr({ ...qr, appStoreUrl: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" htmlFor="f-playstore">
              Lien Google Play (Android)
            </label>
            <input
              id="f-playstore"
              className="input"
              type="url"
              placeholder="https://play.google.com/store/apps/details?id=com.votre.app"
              value={qr.playStoreUrl}
              onChange={(e) => setQr({ ...qr, playStoreUrl: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" htmlFor="f-fallback">
              URL de repli (Windows / Mac / autres)
            </label>
            <input
              id="f-fallback"
              className="input"
              type="url"
              placeholder="Vide = page de présentation intégrée (/app)"
              value={qr.fallbackUrl}
              onChange={(e) => setQr({ ...qr, fallbackUrl: e.target.value })}
            />
          </div>

          {message && (
            <p className="text-sm" style={{ color: message.error ? "var(--critical)" : "var(--good)" }}>
              {message.text}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => patch({ active: !qr.active })}
            >
              {qr.active ? "Désactiver" : "Réactiver"}
            </button>
            <button type="button" className="btn btn-danger ml-auto" onClick={remove}>
              Supprimer
            </button>
          </div>
        </form>

        {/* QR code ou lien de suivi */}
        {qr.type === "link" ? (
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold">🔗 Lien de suivi</h2>
            <TrackedLink slug={qr.slug} />
          </div>
        ) : (
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold">QR code</h2>
          <QrDesigner slug={qr.slug} logo={qr.logo} />
          <div className="border-t pt-4" style={{ borderColor: "var(--grid)" }}>
            <label className="block text-xs font-medium mb-2" htmlFor="f-logo">
              Logo au centre (optionnel)
            </label>
            <div className="flex items-center gap-3">
              <input
                id="f-logo"
                type="file"
                accept="image/*"
                onChange={onLogoChange}
                className="text-xs"
              />
              {qr.logo && (
                <button
                  type="button"
                  className="btn btn-secondary !py-1 text-xs"
                  onClick={() => patch({ logo: null })}
                >
                  Retirer le logo
                </button>
              )}
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
              Correction d&apos;erreur maximale (niveau H) : le QR code reste
              lisible avec un logo couvrant jusqu&apos;à ~25 % de la surface.
              Testez toujours le scan après ajout du logo.
            </p>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
