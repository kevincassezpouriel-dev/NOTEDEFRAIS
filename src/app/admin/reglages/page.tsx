"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface SettingsState {
  autopilotMode: "off" | "draft" | "auto";
  reportEmail: string;
  monthlyBudgetEur: number;
  socialWebhookUrl: string;
  socialNetworks: string[];
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

const NETWORKS = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "x", label: "X (Twitter)" },
  { id: "tiktok", label: "TikTok" },
];

export default function ReglagesPage() {
  const [s, setS] = useState<SettingsState | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/settings", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setS(data);
      setWebhookUrl(data.socialWebhookUrl ?? "");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(data: Record<string, unknown>) {
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
    } else {
      const body = await res.json().catch(() => null);
      setMessage(body?.error ?? "Erreur d'enregistrement.");
    }
  }

  async function testWebhook() {
    setTesting(true);
    setTestResult(null);
    const res = await fetch("/api/admin/webhook/test", { method: "POST" });
    setTesting(false);
    const data = await res.json().catch(() => null);
    setTestResult(data ? `${data.ok ? "✓" : "✗"} ${data.detail}` : "Erreur de test.");
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

  function toggleNetwork(id: string) {
    if (!s) return;
    const next = s.socialNetworks.includes(id)
      ? s.socialNetworks.filter((n) => n !== id)
      : [...s.socialNetworks, id];
    patch({ socialNetworks: next });
  }

  if (!s) return <p className="text-sm" style={{ color: "var(--text-muted)" }}>Chargement…</p>;

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-xl font-semibold">Réglages</h1>

      {/* Identité de marque */}
      <Link href="/admin/marque" className="card p-4 flex items-center gap-3 hover:opacity-90">
        <span className="text-xl">🎨</span>
        <div className="flex-1">
          <p className="text-sm font-semibold">Identité de marque</p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Ton, piliers, interdits, palette — le verrou que l&apos;IA et les visuels
            respectent sans diverger.
          </p>
        </div>
        <span style={{ color: "var(--text-muted)" }}>→</span>
      </Link>

      {/* Réseaux sociaux */}
      <div className="card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Connexion aux réseaux sociaux</h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            Les API d&apos;Instagram/TikTok/Facebook exigent des validations d&apos;application :
            la connexion passe par un <strong>webhook</strong>. Créez un scénario gratuit sur{" "}
            <a href="https://www.make.com" target="_blank" className="underline">Make.com</a>{" "}
            (« Custom webhook » → modules Instagram/Facebook/LinkedIn…), collez son URL
            ici : chaque post publié partira automatiquement, avec son visuel de marque.
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" htmlFor="wh-url">URL du webhook</label>
          <div className="flex gap-2">
            <input
              id="wh-url"
              className="input"
              placeholder="https://hook.eu2.make.com/…"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <button
              className="btn btn-secondary shrink-0"
              onClick={() => patch({ socialWebhookUrl: webhookUrl })}
            >
              Enregistrer
            </button>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium mb-2">Réseaux ciblés (transmis au scénario)</p>
          <div className="flex flex-wrap gap-2">
            {NETWORKS.map((n) => {
              const on = s.socialNetworks.includes(n.id);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => toggleNetwork(n.id)}
                  className="px-3 py-1.5 rounded-full text-sm"
                  style={{
                    background: on ? "var(--accent)" : "transparent",
                    color: on ? "#fff" : "var(--text-secondary)",
                    border: `1px solid ${on ? "var(--accent)" : "var(--baseline)"}`,
                  }}
                >
                  {on ? "✓ " : ""}
                  {n.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-secondary" onClick={testWebhook} disabled={testing || !s.webhookEnabled}>
            {testing ? "Envoi…" : "Envoyer un test"}
          </button>
          {testResult && <span className="text-sm">{testResult}</span>}
        </div>
      </div>

      {/* Intégrations restantes */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold mb-3">Intégrations</h2>
        <ul className="space-y-2 text-sm">
          <StatusRow ok={s.aiEnabled} label="IA (Claude) — textes & direction artistique" hint="ANTHROPIC_API_KEY" />
          <StatusRow ok={s.webhookEnabled} label="Relais réseaux sociaux" hint="URL ci-dessus" />
          <StatusRow ok={s.emailEnabled} label="E-mails (rapports & validation)" hint="RESEND_API_KEY" />
        </ul>
      </div>

      {/* Autopilote */}
      <div className="card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Autopilote marketing</h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            À chaque passage du cron (voir vercel.json), l&apos;autopilote analyse
            vos données, en tire des apprentissages et rédige un post (texte + visuel).
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
          <input
            id="email"
            type="email"
            className="input"
            placeholder="vous@exemple.com"
            defaultValue={s.reportEmail}
            onBlur={(e) => e.target.value !== s.reportEmail && patch({ reportEmail: e.target.value })}
          />
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
