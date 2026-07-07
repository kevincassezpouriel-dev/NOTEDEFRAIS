"use client";

import { useState } from "react";

export default function RgpdPage() {
  const [days, setDays] = useState(365);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function purge(body: { mode: "all" | "olderThan"; days?: number }) {
    setBusy(true);
    setResult(null);
    const res = await fetch("/api/admin/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.ok) {
      const data = await res.json();
      setResult(
        `✓ ${data.deletedScans} scan(s) supprimé(s)` +
          (data.deletedConversions ? ` et ${data.deletedConversions} conversion(s)` : "") +
          "."
      );
    } else {
      setResult("Erreur lors de la suppression.");
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-xl font-semibold">RGPD &amp; données</h1>

      <div className="card p-5 text-sm space-y-2">
        <h2 className="font-semibold">Ce que la plateforme fait déjà</h2>
        <ul className="list-disc pl-5 space-y-1" style={{ color: "var(--text-secondary)" }}>
          <li>
            Les adresses IP sont <strong>anonymisées avant enregistrement</strong>{" "}
            (dernier octet supprimé, IPv6 tronquée à /48). L&apos;IP complète
            n&apos;est jamais écrite en base.
          </li>
          <li>Les coordonnées sont arrondies à ~11 km : précision ville, jamais individu.</li>
          <li>Aucun cookie n&apos;est déposé lors d&apos;un scan.</li>
          <li>
            Une politique de confidentialité publique est disponible sur{" "}
            <a href="/privacy" className="underline" target="_blank">
              /privacy
            </a>{" "}
            — pensez à la personnaliser.
          </li>
          <li>
            Rétention automatique : définissez <code>RETENTION_DAYS</code> dans les
            variables d&apos;environnement pour purger automatiquement les vieux scans.
          </li>
        </ul>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold">Suppression manuelle (droit à l&apos;effacement)</h2>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" htmlFor="purge-days">
              Supprimer les scans plus vieux que
            </label>
            <div className="flex items-center gap-2">
              <input
                id="purge-days"
                type="number"
                min={1}
                className="input !w-24"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              />
              <span className="text-sm">jours</span>
            </div>
          </div>
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => purge({ mode: "olderThan", days })}
          >
            Purger l&apos;historique
          </button>
        </div>

        <div className="border-t pt-4" style={{ borderColor: "var(--grid)" }}>
          <button
            className="btn btn-danger"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Supprimer TOUS les scans et conversions de TOUS les QR codes ?")) {
                purge({ mode: "all" });
              }
            }}
          >
            Tout supprimer
          </button>
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            Les QR codes eux-mêmes sont conservés : seuls les événements de scan
            et les conversions sont effacés.
          </p>
        </div>

        {result && <p className="text-sm">{result}</p>}
      </div>
    </div>
  );
}
