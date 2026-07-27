"use client";

import { useCallback, useEffect, useState } from "react";

interface CampaignRow {
  id: string;
  subject: string;
  status: string;
  aiGenerated: boolean;
  sentAt: string | null;
  sentCount: number;
  opens: number;
  clicks: number;
}

interface ContactsInfo {
  subscribed: number;
  unsubscribed: number;
}

interface SegmentRow {
  id: string;
  name: string;
  rules: string;
  count: number;
}

interface Rule {
  key: string;
  op: "contient" | "egal" | "min" | "max";
  value: string;
}

const OPS: { value: Rule["op"]; label: string }[] = [
  { value: "contient", label: "contient" },
  { value: "egal", label: "est égal à" },
  { value: "min", label: "≥ (nombre)" },
  { value: "max", label: "≤ (nombre)" },
];

/** E-mail marketing : contacts profilés, listes ciblées, campagnes IA, analytics. */
export default function EmailsPage() {
  const [contacts, setContacts] = useState<ContactsInfo | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [attributeKeys, setAttributeKeys] = useState<string[]>([]);
  const [raw, setRaw] = useState("");
  const [brief, setBrief] = useState("");
  const [segName, setSegName] = useState("");
  const [rules, setRules] = useState<Rule[]>([{ key: "", op: "contient", value: "" }]);
  const [targetSegment, setTargetSegment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const load = useCallback(async () => {
    const [cRes, eRes, sRes] = await Promise.all([
      fetch("/api/admin/contacts", { cache: "no-store" }),
      fetch("/api/admin/emails", { cache: "no-store" }),
      fetch("/api/admin/segments", { cache: "no-store" }),
    ]);
    if (cRes.ok) setContacts(await cRes.json());
    if (eRes.ok) setCampaigns(await eRes.json());
    if (sRes.ok) {
      const d = await sRes.json();
      setSegments(d.segments ?? []);
      setAttributeKeys(d.attributeKeys ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function importList() {
    setBusy("import");
    setMessage(null);
    const res = await fetch("/api/admin/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });
    setBusy(null);
    if (res.ok) {
      const d = await res.json();
      setRaw("");
      setMessage({
        text: `✓ ${d.imported} contact(s) importés — les colonnes du CSV deviennent des attributs filtrables.`,
        error: false,
      });
      load();
    } else setMessage({ text: "Import impossible", error: true });
  }

  async function createSegment() {
    const clean = rules.filter((r) => r.key && r.value);
    if (!segName.trim() || clean.length === 0) {
      setMessage({ text: "Nom de liste + au moins une règle complète requis.", error: true });
      return;
    }
    setBusy("segment");
    const res = await fetch("/api/admin/segments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: segName, rules: clean }),
    });
    setBusy(null);
    if (res.ok) {
      setSegName("");
      setRules([{ key: "", op: "contient", value: "" }]);
      setMessage({ text: "✓ Liste créée.", error: false });
      load();
    } else setMessage({ text: "Création impossible", error: true });
  }

  async function generate() {
    setBusy("gen");
    setMessage(null);
    const res = await fetch("/api/admin/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief: brief || undefined }),
    });
    setBusy(null);
    if (res.ok) {
      setBrief("");
      setMessage({ text: "✓ Campagne générée — prévisualise puis envoie.", error: false });
      load();
    } else {
      const d = await res.json().catch(() => null);
      setMessage({ text: d?.error ?? "Erreur de génération", error: true });
    }
  }

  async function send(c: CampaignRow) {
    const target = segments.find((s) => s.id === targetSegment);
    const n = target ? target.count : contacts?.subscribed ?? 0;
    if (!n) {
      setMessage({ text: "Aucun contact dans la cible choisie.", error: true });
      return;
    }
    if (!window.confirm(`Envoyer « ${c.subject} » à ${n} contact(s) ${target ? `(liste « ${target.name} »)` : "(liste complète)"} ?`))
      return;
    setBusy(c.id);
    setMessage(null);
    const res = await fetch(`/api/admin/emails/${c.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segmentId: targetSegment || undefined }),
    });
    setBusy(null);
    if (res.ok) {
      const d = await res.json();
      setMessage({ text: `🚀 Envoyé à ${d.sent} contact(s).`, error: false });
      load();
    } else {
      const d = await res.json().catch(() => null);
      setMessage({ text: d?.error ?? "Envoi impossible", error: true });
    }
  }

  async function removeCampaign(c: CampaignRow) {
    if (!window.confirm(`Supprimer « ${c.subject} » ?`)) return;
    await fetch(`/api/admin/emails/${c.id}`, { method: "DELETE" });
    load();
  }

  const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)} %` : "—");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">E-mail marketing</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Contacts profilés, listes ciblées, campagnes générées par l&apos;IA dans ta
          charte, envoi en un clic et taux d&apos;ouverture/clic mesurés.
        </p>
      </div>

      {message && (
        <p className="text-sm" style={{ color: message.error ? "var(--critical)" : "var(--good)" }}>
          {message.text}
        </p>
      )}

      {/* Contacts */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="text-sm font-semibold mr-auto">👥 Contacts</h2>
          <span className="text-sm"><strong>{contacts?.subscribed ?? "…"}</strong> abonnés</span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {contacts?.unsubscribed ?? 0} désinscrits
          </span>
        </div>
        <textarea
          className="input font-mono text-xs"
          rows={4}
          placeholder={"Colle ton CSV AVEC EN-TÊTE ici — ex. :\nemail;genre;age;statut;interets\nlea@mail.com;femme;23;colocataire;jeux de société, cuisine\n(ou une simple liste d'e-mails)"}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        <div className="flex items-center gap-3 flex-wrap">
          <button className="btn btn-secondary" onClick={importList} disabled={busy === "import" || !raw.trim()}>
            {busy === "import" ? "Import…" : "📥 Importer"}
          </button>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Depuis ton app : POST <code>/api/contacts/subscribe</code> {"{ email, name? }"}.
            Ré-importer un CSV met à jour les profils existants.
          </span>
        </div>
      </div>

      {/* Listes ciblées */}
      <div className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold">🎯 Listes ciblées</h2>
        {attributeKeys.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Importe un CSV avec des colonnes de profil (genre, âge, statut, intérêts…) pour
            débloquer les filtres.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-xs font-medium mb-1">Nom de la liste</label>
                <input className="input !w-48" placeholder="Femmes 18-25"
                  value={segName} onChange={(e) => setSegName(e.target.value)} />
              </div>
              {rules.map((r, i) => (
                <div key={i} className="flex items-end gap-1.5">
                  <div>
                    {i === 0 && <label className="block text-xs font-medium mb-1">Attribut</label>}
                    <select className="input !w-36" value={r.key}
                      onChange={(e) => {
                        const next = [...rules]; next[i] = { ...r, key: e.target.value }; setRules(next);
                      }}>
                      <option value="">— champ —</option>
                      {attributeKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <select className="input !w-32" value={r.op}
                    onChange={(e) => {
                      const next = [...rules]; next[i] = { ...r, op: e.target.value as Rule["op"] }; setRules(next);
                    }}>
                    {OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input className="input !w-36" placeholder="valeur" value={r.value}
                    onChange={(e) => {
                      const next = [...rules]; next[i] = { ...r, value: e.target.value }; setRules(next);
                    }} />
                </div>
              ))}
              {rules.length < 4 && (
                <button type="button" className="btn btn-secondary !py-1.5 text-xs"
                  onClick={() => setRules([...rules, { key: "", op: "contient", value: "" }])}>
                  + règle
                </button>
              )}
              <button className="btn btn-primary" onClick={createSegment} disabled={busy === "segment"}>
                Créer la liste
              </button>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Ex. : « Femmes 18-25 » = genre est égal à femme + age ≥ 18 + age ≤ 25 ·
              « Fans de jeux » = interets contient jeux · « Colocataires » = statut contient coloc.
            </p>
          </>
        )}
        {segments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {segments.map((s) => (
              <span key={s.id} className="text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1.5"
                style={{ background: "var(--grid)" }}>
                <strong>{s.name}</strong> · {s.count} contact(s)
                <button aria-label="Supprimer" style={{ color: "var(--text-muted)" }}
                  onClick={async () => { await fetch(`/api/admin/segments/${s.id}`, { method: "DELETE" }); load(); }}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Génération */}
      <div className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold">✨ Générer une campagne avec Claude</h2>
        <div className="flex flex-wrap gap-3">
          <input className="input flex-1 min-w-64"
            placeholder="Brief (optionnel) — ex. : « 3 bons plans logement étudiant de la rentrée »"
            value={brief} onChange={(e) => setBrief(e.target.value)} />
          <button className="btn btn-primary" onClick={generate} disabled={busy === "gen"}>
            {busy === "gen" ? "Rédaction… (~20 s)" : "✨ Générer un brouillon"}
          </button>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          HTML de marque (logo, couleurs, CTA tracké, désinscription RGPD). Stratégie 80/20 :
          de la valeur d&apos;abord.
        </p>
      </div>

      {/* Campagnes + analytics */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-sm font-semibold mr-auto">📬 Campagnes</h2>
          <label className="text-xs flex items-center gap-2">
            Cible d&apos;envoi :
            <select className="input !w-auto !py-1" value={targetSegment}
              onChange={(e) => setTargetSegment(e.target.value)}>
              <option value="">Liste complète ({contacts?.subscribed ?? 0})</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.count})</option>
              ))}
            </select>
          </label>
        </div>
        {campaigns.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Aucune campagne. Génère la première ci-dessus.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs border-b"
                  style={{ color: "var(--text-muted)", borderColor: "var(--grid)" }}>
                  <th className="py-2 pr-3 font-medium">Objet</th>
                  <th className="py-2 pr-3 font-medium">Statut</th>
                  <th className="py-2 pr-3 font-medium text-right">Envoyés</th>
                  <th className="py-2 pr-3 font-medium text-right">Ouverture</th>
                  <th className="py-2 pr-3 font-medium text-right">Clics</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b" style={{ borderColor: "var(--grid)" }}>
                    <td className="py-2.5 pr-3 font-medium max-w-xs truncate">
                      {c.aiGenerated ? "✨ " : ""}{c.subject}
                    </td>
                    <td className="py-2.5 pr-3">
                      {c.status === "sent" ? (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ color: "var(--good)", background: "var(--grid)" }}>Envoyée</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full border"
                          style={{ color: "var(--text-muted)", borderColor: "var(--baseline)" }}>Brouillon</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{c.sentCount || "—"}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{pct(c.opens, c.sentCount)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{pct(c.clicks, c.sentCount)}</td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <span className="inline-flex gap-1.5">
                        <a href={`/api/admin/emails/${c.id}?format=html`} target="_blank"
                          className="btn btn-secondary !py-1">Aperçu ↗</a>
                        {c.status !== "sent" && (
                          <>
                            <button className="btn btn-primary !py-1" disabled={busy === c.id}
                              onClick={() => send(c)}>
                              {busy === c.id ? "Envoi…" : "🚀 Envoyer"}
                            </button>
                            <button className="btn btn-danger !py-1" onClick={() => removeCampaign(c)}>×</button>
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
