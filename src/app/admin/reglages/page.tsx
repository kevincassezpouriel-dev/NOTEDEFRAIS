"use client";

import { useCallback, useEffect, useState } from "react";

interface SettingsState {
  autopilotMode: "off" | "draft" | "auto";
  reportEmail: string;
  monthlyBudgetEur: number;
  aiEnabled: boolean;
  emailEnabled: boolean;
  webhookEnabled: boolean;
}

const MODES: { value: "off" | "draft" | "auto"; label: string; desc: string }[] = [
  { value: "off", label: "Désactivé", desc: "L'autopilote ne fait rien." },
  {
    value: "draft",
    label: "Validation",
    desc: "L'autopilote rédige et vous envoie un e-mail avec un bouton « Publier » 1-clic. Vous gardez le contrôle.",
  },
  {
    value: "auto",
    label: "Automatique",
    desc: "L'autopilote rédige ET publie seul (site + réseaux). Zéro intervention.",
  },
];

export default function ReglagesPage() {
  const [s, setS] = useState<SettingsState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/settings", { cache: "no-store" });
    if (res.ok) setS(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(data: Partial<SettingsState>) {
    setMessage(null);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      setS((prev) => (prev ? { ...prev, ...updated } : prev));
      setMessage("✓ Enregistré.");
    }
  }

  async function runNow() {
    setRunning(true);
    setRunResult(null);
    const res = await fetch("/api/admin/engine/run", { method: "POST" });
    setRunning(false);
    const data = await res.json().catch(() => null);
    if (data?.ran) {
      setRunResult(
        `✓ Cycle exécuté : ${data.learningsAdded ?? 0} apprentissage(s), post « ${data.postTitle} » ${
          data.published ? "publié" : "créé en brouillon (à valider)"
        }.`
      );
    } else {
      setRunResult(`Cycle non exécuté : ${data?.reason ?? "erreur"}.`);
    }
  }

  if (!s) return <p className="text-sm" style={{ color: "var(--text-muted)" }}>Chargement…</p>;

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-xl font-semibold">Réglages</h1>

      {/* État des intégrations */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold mb-3">Intégrations</h2>
        <ul className="space-y-2 text-sm">
          <StatusRow ok={s.aiEnabled} label="IA (Claude)" hint="ANTHROPIC_API_KEY" />
          <StatusRow ok={s.webhookEnabled} label="Relais réseaux sociaux" hint="SOCIAL_WEBHOOK_URL" />
          <StatusRow ok={s.emailEnabled} label="E-mails (rapports & validation)" hint="RESEND_API_KEY" />
        </ul>
      </div>

      {/* Autopilote */}
      <div className="card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Autopilote marketing</h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            À chaque passage du cron (voir vercel.json), l&apos;autopilote analyse
            vos données, en tire des apprentissages et rédige un post.
          </p>
        </div>

        <div className="space-y-2">
          {MODES.map((m) => (
            <label
              key={m.value}
              className="flex gap-3 p-3 rounded-lg cursor-pointer"
              style={{
                border: `1px solid ${s.autopilotMode === m.value ? "var(--accent)" : "var(--grid)"}`,
                background: s.autopilotMode === m.value ? "var(--page)" : "transparent",
              }}
            >
              <input
                type="radio"
                name="mode"
                checked={s.autopilotMode === m.value}
                onChange={() => patch({ autopilotMode: m.value })}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium">{m.label}</p>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {m.desc}
                </p>
              </div>
            </label>
          ))}
        </div>

        {s.autopilotMode !== "off" && !s.aiEnabled && (
          <p className="text-sm" style={{ color: "var(--critical)" }}>
            ⚠️ L&apos;autopilote a besoin de la clé <code>ANTHROPIC_API_KEY</code> pour fonctionner.
          </p>
        )}

        <div>
          <label className="block text-xs font-medium mb-1" htmlFor="email">
            E-mail des rapports et validations
          </label>
          <div className="flex gap-2">
            <input
              id="email"
              type="email"
              className="input"
              placeholder="vous@exemple.com"
              defaultValue={s.reportEmail}
              onBlur={(e) => e.target.value !== s.reportEmail && patch({ reportEmail: e.target.value })}
            />
          </div>
          {s.autopilotMode === "draft" && !s.emailEnabled && (
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Sans <code>RESEND_API_KEY</code>, les brouillons restent visibles dans
              l&apos;onglet Posts (pas d&apos;e-mail envoyé) — l&apos;autopilote fonctionne quand même.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 pt-1 border-t" style={{ borderColor: "var(--grid)" }}>
          <button className="btn btn-secondary mt-3" onClick={runNow} disabled={running}>
            {running ? "Exécution… (~30 s)" : "▶ Lancer un cycle maintenant"}
          </button>
          {message && <span className="text-sm mt-3" style={{ color: "var(--good)" }}>{message}</span>}
        </div>
        {runResult && (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {runResult}
          </p>
        )}
      </div>
    </div>
  );
}

function StatusRow({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <li className="flex items-center gap-2">
      <span style={{ color: ok ? "var(--good)" : "var(--text-muted)" }}>{ok ? "●" : "○"}</span>
      <span>{label}</span>
      <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
        {ok ? "configuré" : hint}
      </span>
    </li>
  );
}
