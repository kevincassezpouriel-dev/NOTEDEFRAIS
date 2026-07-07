"use client";

import { useEffect, useState } from "react";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { FeatureCollection, Geometry } from "geojson";

export interface CityPoint {
  city: string;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  count: number;
}

const W = 960;
const H = 480;

/** Projection équirectangulaire simple (le fond de carte est en degrés). */
function project(lon: number, lat: number): [number, number] {
  return [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];
}

function ringToPath(ring: number[][]): string {
  return (
    ring
      .map(([lon, lat], i) => {
        const [x, y] = project(lon, lat);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join("") + "Z"
  );
}

function geometryToPath(geom: Geometry): string {
  if (geom.type === "Polygon") return geom.coordinates.map(ringToPath).join("");
  if (geom.type === "MultiPolygon") {
    return geom.coordinates.map((poly) => poly.map(ringToPath).join("")).join("");
  }
  return "";
}

export default function WorldMap({ cities }: { cities: CityPoint[] }) {
  const [paths, setPaths] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/world-110m.json")
      .then((r) => r.json())
      .then((topo: Topology) => {
        if (cancelled) return;
        const fc = feature(
          topo,
          topo.objects.countries
        ) as unknown as FeatureCollection;
        setPaths(fc.features.map((f) => geometryToPath(f.geometry)));
      })
      .catch(() => setPaths([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const points = cities.filter(
    (c) => typeof c.latitude === "number" && typeof c.longitude === "number"
  );
  const maxCount = Math.max(...points.map((p) => p.count), 1);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 ${H * 0.05} ${W} ${H * 0.78}`}
        className="w-full h-auto"
        role="img"
        aria-label="Carte du monde des scans par ville"
      >
        {paths?.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="var(--grid)"
            stroke="var(--surface-1)"
            strokeWidth={0.5}
          />
        ))}
        {points.map((p) => {
          const [x, y] = project(p.longitude as number, p.latitude as number);
          const r = 3 + Math.sqrt(p.count / maxCount) * 11;
          return (
            <circle
              key={`${p.city}|${p.country}`}
              cx={x}
              cy={y}
              r={r}
              fill="var(--series-1)"
              fillOpacity={0.55}
              stroke="var(--surface-1)"
              strokeWidth={1}
            >
              <title>
                {p.city}
                {p.country ? `, ${p.country}` : ""} — {p.count} scan{p.count > 1 ? "s" : ""}
              </title>
            </circle>
          );
        })}
      </svg>
      {points.length === 0 && (
        <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
          Aucune ville géolocalisée sur la période (la géolocalisation demande
          quelques scans réels : en local, les IP privées ne sont pas localisables).
        </p>
      )}
    </div>
  );
}
