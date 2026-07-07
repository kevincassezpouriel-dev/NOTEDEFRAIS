"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Erreur de connexion");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <form onSubmit={submit} className="card w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold mb-1">Administration</h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          Connectez-vous pour gérer vos QR codes.
        </p>
        <label className="block text-sm font-medium mb-1" htmlFor="password">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          className="input mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
        />
        {error && (
          <p className="text-sm mb-4" style={{ color: "var(--critical)" }}>
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary w-full justify-center" disabled={loading}>
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </main>
  );
}
