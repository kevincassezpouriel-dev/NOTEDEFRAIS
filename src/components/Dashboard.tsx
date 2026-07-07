"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import StatTile from "./StatTile";
import ScansChart, { DayPoint } from "./ScansChart";
import DeviceSplit from "./DeviceSplit";
import TopList from "./TopList";
import WorldMap, { CityPoint } from "./WorldMap";
import RecentScans from "./RecentScans";

interface QrSummary {
  id: string;
  name: string;
  slug: string;
}

interface Stats {
  total: number;
  today: number;
  last7: number;
  period: number;
  days: number;
  totalConversions: number;
  byDay: DayPoint[];
  devices: Record<string, number>;
  redirects: Record<string, number>;
  countries: { country: string; countryCode: string | null; count: number }[];
  cities: CityPoint[];
  perQr: {
    id: string;
    name: string;
    slug: string;
    active: boolean;
    total: number;
    conversions: number;
    period: number;
    today: number;
  }[];
}

const RANGES = [7, 30, 90] as const;

export default function Dashboard() {
  const [qrcodes, setQrcodes] = useState<QrSummary[]>([]);
  const [qrId, setQrId] = useState<string>("");
  const [days, setDays] = useState<number>(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/qrcodes")
      .then((r) => (r.ok ? r.json() : []))
      .then(setQrcodes)
      .catch(() => {});
  }, []);

  const loadStats = useCallback(async () => {
    const params = new URLSearchParams({ days: String(days) });
    if (qrId) params.set("qr", qrId);
    try {
      const res = await fetch(`/api/admin/stats?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      setStats(await res.json());
      setError(null);
    } catch {
      setError(
        "Impossible de charger les statistiques. Vérifiez que la base de données est accessible."
      );
    }
  }, [qrId, days]);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30_000);
    return () => clearInterval(interval);
  }, [loadStats]);

  function exportCsv() {
    const params = new URLSearchParams({ days: String(days) });
    if (qrId) params.set("qr", qrId);
    window.location.href = `/api/admin/export?${params}`;
  }

  return (
    <div className="space-y-4">
      {/* Filtres : une seule rangée au-dessus des graphiques */}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold mr-auto">Tableau de bord</h1>
        <select
          className="input !w-auto"
          value={qrId}
          onChange={(e) => setQrId(e.target.value)}
          aria-label="Filtrer par QR code"
        >
          <option value="">Tous les QR codes</option>
          {qrcodes.map((qr) => (
            <option key={qr.id} value={qr.id}>
              {qr.name}
            </option>
          ))}
        </select>
        <div
          className="flex rounded-lg border overflow-hidden"
          style={{ borderColor: "var(--baseline)" }}
        >
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              className="px-3 py-2 text-sm"
              style={{
                background: days === r ? "var(--accent)" : "var(--surface-1)",
                color: days === r ? "#fff" : "var(--text-secondary)",
                fontWeight: days === r ? 600 : 400,
              }}
            >
              {r} j
            </button>
          ))}
        </div>
        <button onClick={exportCsv} className="btn btn-secondary">
          ⬇ Export CSV
        </button>
      </div>

      {error && (
        <div className="card p-4 text-sm" style={{ color: "var(--critical)" }}>
          {error}
        </div>
      )}

      {/* Rangée de KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Scans (total)" value={stats?.total ?? "—"} />
        <StatTile label="Aujourd'hui" value={stats?.today ?? "—"} />
        <StatTile label={`${days} derniers jours`} value={stats?.period ?? "—"} />
        <StatTile
          label="Conversions"
          value={stats?.totalConversions ?? "—"}
          hint="installations confirmées"
        />
      </div>

      {/* Évolution */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold mb-3">Évolution des scans par jour</h2>
        {stats ? (
          <ScansChart data={stats.byDay} />
        ) : (
          <div className="h-[280px]" />
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Répartition des appareils */}
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3">Répartition des appareils</h2>
          {stats && <DeviceSplit devices={stats.devices} />}
        </div>

        {/* Destinations de redirection */}
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3">Destinations</h2>
          {stats && (
            <TopList
              emptyLabel="Aucune redirection sur la période."
              items={[
                { label: "App Store (iOS)", count: stats.redirects.appstore ?? 0 },
                { label: "Google Play (Android)", count: stats.redirects.playstore ?? 0 },
                { label: "Page web (autres)", count: stats.redirects.fallback ?? 0 },
              ]
                .filter((i) => i.count > 0)
                .sort((a, b) => b.count - a.count)}
            />
          )}
        </div>
      </div>

      {/* Carte */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold mb-3">Carte des scans (villes)</h2>
        {stats && <WorldMap cities={stats.cities} />}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3">Top pays</h2>
          {stats && (
            <TopList
              emptyLabel="Aucun pays identifié sur la période."
              items={stats.countries.slice(0, 10).map((c) => ({
                label: c.country,
                count: c.count,
              }))}
            />
          )}
        </div>
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3">Top villes</h2>
          {stats && (
            <TopList
              emptyLabel="Aucune ville identifiée sur la période."
              items={stats.cities.slice(0, 10).map((c) => ({
                label: c.city,
                sublabel: c.country ?? undefined,
                count: c.count,
              }))}
            />
          )}
        </div>
      </div>

      {/* Comparaison des campagnes */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold mb-3">Comparaison des QR codes</h2>
        {stats && stats.perQr.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-xs border-b"
                  style={{ color: "var(--text-muted)", borderColor: "var(--grid)" }}
                >
                  <th className="py-2 pr-3 font-medium">Campagne</th>
                  <th className="py-2 pr-3 font-medium text-right">Aujourd&apos;hui</th>
                  <th className="py-2 pr-3 font-medium text-right">Période ({days} j)</th>
                  <th className="py-2 pr-3 font-medium text-right">Total</th>
                  <th className="py-2 pr-3 font-medium text-right">Conversions</th>
                  <th className="py-2 font-medium text-right">Taux de conv.</th>
                </tr>
              </thead>
              <tbody>
                {stats.perQr.map((qr) => (
                  <tr key={qr.id} className="border-b" style={{ borderColor: "var(--grid)" }}>
                    <td className="py-2 pr-3">
                      <Link href={`/admin/qrcodes/${qr.id}`} className="underline">
                        {qr.name}
                      </Link>
                      {!qr.active && (
                        <span className="text-xs ml-2" style={{ color: "var(--critical)" }}>
                          (désactivé)
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{qr.today}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{qr.period}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{qr.total}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{qr.conversions}</td>
                    <td className="py-2 text-right tabular-nums">
                      {qr.total > 0
                        ? `${((qr.conversions / qr.total) * 100).toFixed(1)} %`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Créez votre premier QR code dans l&apos;onglet « QR codes ».
          </p>
        )}
      </div>

      {/* Temps réel */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold mb-3">
          Derniers scans{" "}
          <span className="font-normal text-xs" style={{ color: "var(--text-muted)" }}>
            (actualisé toutes les 5 s)
          </span>
        </h2>
        <RecentScans qrId={qrId || null} />
      </div>
    </div>
  );
}
