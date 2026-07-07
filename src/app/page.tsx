import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="card max-w-lg w-full p-10 text-center">
        <div className="text-5xl mb-4">▣</div>
        <h1 className="text-2xl font-semibold mb-2">QR Platform</h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
          QR codes dynamiques auto-hébergés : redirection intelligente vers
          l&apos;App Store et Google Play, statistiques en temps réel, RGPD.
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/admin" className="btn btn-primary">
            Interface administrateur
          </Link>
          <Link href="/app" className="btn btn-secondary">
            Page de présentation
          </Link>
        </div>
      </div>
    </main>
  );
}
