"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

interface PostRow {
  id: string;
  title: string;
  status: string;
  aiGenerated: boolean;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
}

const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Calendrier éditorial : tous les posts placés sur leur date de
 *  publication (réelle ou programmée) ; les brouillons à planifier à part. */
interface BestTimesInfo {
  slots: { label: string; score: number }[];
  basedOn: number;
  estimated: boolean;
}

export default function CalendrierPage() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [bestTimes, setBestTimes] = useState<BestTimesInfo | null>(null);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const load = useCallback(async () => {
    const [res, btRes] = await Promise.all([
      fetch("/api/admin/posts", { cache: "no-store" }),
      fetch("/api/admin/besttime", { cache: "no-store" }),
    ]);
    if (res.ok) setPosts(await res.json());
    if (btRes.ok) setBestTimes(await btRes.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { cells, byDay, drafts } = useMemo(() => {
    const byDay = new Map<string, PostRow[]>();
    const drafts: PostRow[] = [];
    for (const p of posts) {
      const dateStr = p.status === "scheduled" ? p.scheduledAt : p.publishedAt;
      if (!dateStr) {
        drafts.push(p);
        continue;
      }
      const key = dateKey(new Date(dateStr));
      byDay.set(key, [...(byDay.get(key) ?? []), p]);
    }
    // grille du mois (lundi → dimanche)
    const first = new Date(month);
    const offset = (first.getDay() + 6) % 7; // 0 = lundi
    const start = new Date(first);
    start.setDate(1 - offset);
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(d);
    }
    return { cells, byDay, drafts };
  }, [posts, month]);

  const todayKey = dateKey(new Date());
  const monthLabel = month.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  function shift(delta: number) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-semibold mr-auto">Calendrier éditorial</h1>
        <div className="flex items-center gap-2">
          <button className="btn btn-secondary !py-1.5" onClick={() => shift(-1)} aria-label="Mois précédent">
            ‹
          </button>
          <span className="text-sm font-medium w-40 text-center capitalize">{monthLabel}</span>
          <button className="btn btn-secondary !py-1.5" onClick={() => shift(1)} aria-label="Mois suivant">
            ›
          </button>
        </div>
      </div>

      {/* Meilleurs créneaux (principe Buffer/Later : quand l'audience est là) */}
      {bestTimes && (
        <div className="card p-4">
          <p className="text-sm font-semibold mb-1">🕐 Meilleurs créneaux pour publier</p>
          <div className="flex flex-wrap items-center gap-2">
            {bestTimes.slots.map((s, i) => (
              <span
                key={i}
                className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{ background: "var(--grid)", color: "var(--text-primary)" }}
              >
                {i === 0 ? "⭐ " : ""}
                {s.label}
                {!bestTimes.estimated && s.score > 0 ? ` · ${s.score} interactions` : ""}
              </span>
            ))}
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {bestTimes.estimated
                ? "Estimation type audience jeune — se précisera avec tes vrais scans."
                : `Calculé sur ${bestTimes.basedOn} interactions réelles (60 derniers jours).`}
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--good)" }} /> Publié
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--series-3)" }} /> Programmé
        </span>
        <span>✨ = généré par l&apos;IA</span>
      </div>

      <div className="card p-3 overflow-x-auto">
        <div className="grid grid-cols-7 min-w-[720px]">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-xs font-medium p-2" style={{ color: "var(--text-muted)" }}>
              {d}
            </div>
          ))}
          {cells.map((d, i) => {
            const key = dateKey(d);
            const inMonth = d.getMonth() === month.getMonth();
            const dayPosts = byDay.get(key) ?? [];
            return (
              <div
                key={i}
                className="min-h-24 p-1.5 border-t"
                style={{
                  borderColor: "var(--grid)",
                  opacity: inMonth ? 1 : 0.38,
                  background: key === todayKey ? "var(--page)" : "transparent",
                }}
              >
                <p
                  className="text-xs mb-1"
                  style={{
                    color: key === todayKey ? "var(--accent)" : "var(--text-muted)",
                    fontWeight: key === todayKey ? 700 : 400,
                  }}
                >
                  {d.getDate()}
                </p>
                <div className="space-y-1">
                  {dayPosts.map((p) => (
                    <Link
                      key={p.id}
                      href={`/admin/posts/${p.id}`}
                      className="block text-xs px-1.5 py-1 rounded truncate"
                      title={p.title}
                      style={{
                        background: "var(--grid)",
                        borderLeft: `3px solid ${p.status === "published" ? "var(--good)" : "var(--series-3)"}`,
                      }}
                    >
                      {p.aiGenerated ? "✨ " : ""}
                      {p.title}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Brouillons à planifier */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold mb-3">
          Brouillons à planifier{" "}
          <span className="font-normal text-xs" style={{ color: "var(--text-muted)" }}>
            (ouvrez un post pour le programmer à une date)
          </span>
        </h2>
        {drafts.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Aucun brouillon en attente.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {drafts.map((p) => (
              <li key={p.id} className="text-sm">
                <Link href={`/admin/posts/${p.id}`} className="underline">
                  {p.aiGenerated ? "✨ " : ""}
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
