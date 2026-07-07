"use client";

import { useCallback, useEffect, useState } from "react";

interface Scan {
  id: string;
  createdAt: string;
  qrName: string;
  deviceType: string;
  os: string | null;
  browser: string | null;
  language: string | null;
  country: string | null;
  city: string | null;
  referrer: string | null;
  redirectedTo: string;
}

const DEVICE_LABELS: Record<string, string> = {
  iphone: "iPhone",
  ipad: "iPad",
  android: "Android",
  windows: "Windows",
  mac: "Mac",
  linux: "Linux",
  other: "Autre",
};

const REDIRECT_LABELS: Record<string, string> = {
  appstore: "App Store",
  playstore: "Google Play",
  fallback: "Page web",
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 10) return "à l'instant";
  if (s < 60) return `il y a ${s} s`;
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

/** Table « temps réel » : actualisée toutes les 5 secondes. */
export default function RecentScans({ qrId }: { qrId: string | null }) {
  const [scans, setScans] = useState<Scan[]>([]);
  const [, forceTick] = useState(0);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: "25" });
    if (qrId) params.set("qr", qrId);
    const res = await fetch(`/api/admin/scans?${params}`, { cache: "no-store" });
    if (res.ok) setScans(await res.json());
  }, [qrId]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 5000);
    const tick = setInterval(() => forceTick((n) => n + 1), 10_000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  if (scans.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Aucun scan pour le moment. Scannez votre QR code pour voir apparaître
        les événements ici en direct.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr
            className="text-left text-xs border-b"
            style={{ color: "var(--text-muted)", borderColor: "var(--grid)" }}
          >
            <th className="py-2 pr-3 font-medium">Quand</th>
            <th className="py-2 pr-3 font-medium">QR code</th>
            <th className="py-2 pr-3 font-medium">Appareil</th>
            <th className="py-2 pr-3 font-medium">Navigateur</th>
            <th className="py-2 pr-3 font-medium">Lieu</th>
            <th className="py-2 pr-3 font-medium">Langue</th>
            <th className="py-2 font-medium">Redirection</th>
          </tr>
        </thead>
        <tbody>
          {scans.map((s) => (
            <tr key={s.id} className="border-b" style={{ borderColor: "var(--grid)" }}>
              <td className="py-2 pr-3 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                {timeAgo(s.createdAt)}
              </td>
              <td className="py-2 pr-3">{s.qrName}</td>
              <td className="py-2 pr-3 whitespace-nowrap">
                {DEVICE_LABELS[s.deviceType] ?? s.deviceType}
                {s.os && s.os !== (DEVICE_LABELS[s.deviceType] ?? s.deviceType) && (
                  <span style={{ color: "var(--text-muted)" }}> · {s.os}</span>
                )}
              </td>
              <td className="py-2 pr-3">{s.browser ?? "—"}</td>
              <td className="py-2 pr-3">
                {s.city ? `${s.city}, ` : ""}
                {s.country ?? "—"}
              </td>
              <td className="py-2 pr-3">{s.language ?? "—"}</td>
              <td className="py-2 whitespace-nowrap">
                {REDIRECT_LABELS[s.redirectedTo] ?? s.redirectedTo}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
