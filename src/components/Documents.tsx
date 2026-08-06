"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { CANAUX, DOCUMENT_TYPES, labelOf } from "@/lib/crm";

interface Doc {
  id: string;
  type: string;
  nomFichier: string;
  url: string;
  envoyeLe: string | null;
  canalEnvoi: string | null;
  createdAt: string;
}

/**
 * Pièces jointes : téléversement direct navigateur → Vercel Blob (jusqu'à
 * 20 Mo, sans passer par la fonction serverless), plus la possibilité de
 * coller un simple lien. Chaque document garde la trace de son envoi.
 */
export default function Documents({
  contactId,
  candidatureId,
  titre = "Pièces jointes",
}: {
  contactId?: string;
  candidatureId?: string;
  titre?: string;
}) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [type, setType] = useState("autre");
  const [lien, setLien] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const params = new URLSearchParams();
  if (contactId) params.set("contactId", contactId);
  if (candidatureId) params.set("candidatureId", candidatureId);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/documents?${params}`, { cache: "no-store" });
    if (res.ok) setDocs(await res.json());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId, candidatureId]);

  useEffect(() => {
    load();
  }, [load]);

  async function enregistrer(url: string, nomFichier: string) {
    await fetch("/api/admin/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, nomFichier, type, contactId, candidatureId }),
    });
    load();
  }

  async function televerser(file: File) {
    setBusy(true);
    setErreur(null);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/admin/documents/upload",
      });
      await enregistrer(blob.url, file.name);
    } catch (e) {
      setErreur(
        e instanceof Error && /token|BLOB/i.test(e.message)
          ? "Stockage non configuré : crée un store Blob sur Vercel (Storage → Blob), il ajoute BLOB_READ_WRITE_TOKEN automatiquement. En attendant, colle un lien ci-dessous."
          : "Téléversement impossible."
      );
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function supprimer(id: string) {
    if (!window.confirm("Supprimer ce document ?")) return;
    await fetch(`/api/admin/documents/${id}`, { method: "DELETE" });
    load();
  }

  async function marquerEnvoye(d: Doc, canal: string) {
    await fetch(`/api/admin/documents/${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ envoyeLe: new Date().toISOString(), canalEnvoi: canal }),
    });
    load();
  }

  return (
    <div className="card p-4 space-y-3">
      <h2 className="text-sm font-semibold">📎 {titre}</h2>

      <div className="flex flex-wrap items-center gap-2">
        <select className="input !w-auto !py-1 text-xs" value={type} onChange={(e) => setType(e.target.value)}>
          {DOCUMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input
          ref={fileRef}
          type="file"
          className="text-xs"
          disabled={busy}
          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) televerser(f);
          }}
        />
        {busy && <span className="text-xs" style={{ color: "var(--text-muted)" }}>Envoi…</span>}
      </div>

      <div className="flex gap-2">
        <input
          className="input flex-1 text-xs"
          placeholder="…ou colle un lien (Drive, WeTransfer…)"
          value={lien}
          onChange={(e) => setLien(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-secondary !py-1 text-xs"
          disabled={!/^https?:\/\//.test(lien)}
          onClick={async () => {
            await enregistrer(lien, lien.split("/").pop() || "lien");
            setLien("");
          }}
        >
          Ajouter
        </button>
      </div>

      {erreur && <p className="text-xs" style={{ color: "var(--critical)" }}>{erreur}</p>}

      {docs.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Aucun document.</p>
      ) : (
        <ul className="space-y-1.5">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-2 text-sm">
              <a href={d.url} target="_blank" rel="noopener" className="hover:underline truncate flex-1">
                {d.nomFichier}
              </a>
              <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: "var(--grid)" }}>
                {labelOf(DOCUMENT_TYPES, d.type)}
              </span>
              {d.envoyeLe ? (
                <span className="text-xs shrink-0" style={{ color: "var(--good)" }}>
                  ✓ envoyé {d.canalEnvoi ? `(${labelOf(CANAUX, d.canalEnvoi)})` : ""}
                </span>
              ) : (
                <select
                  className="input !w-auto !py-0.5 text-xs shrink-0"
                  defaultValue=""
                  onChange={(e) => e.target.value && marquerEnvoye(d, e.target.value)}
                >
                  <option value="">marquer envoyé…</option>
                  {CANAUX.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              )}
              <button
                type="button"
                aria-label="Supprimer"
                className="text-xs w-5 h-5 rounded-full leading-none shrink-0"
                style={{ background: "var(--page)", color: "var(--text-muted)" }}
                onClick={() => supprimer(d.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
