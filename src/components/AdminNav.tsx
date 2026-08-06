"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/proprietaires", label: "Propriétaires" },
  { href: "/admin/annonces", label: "Annonces" },
  { href: "/admin/candidatures", label: "Candidatures" },
  { href: "/admin/transmissions", label: "Transmissions" },
  { href: "/admin/qrcodes", label: "QR & liens" },
  { href: "/admin/emails", label: "E-mails" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/admin/login") return null;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <header
      className="sticky top-0 z-10 border-b"
      style={{
        background: "var(--nav-bg)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderColor: "var(--border)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-5">
        <Link href="/admin" className="flex items-center gap-2.5 shrink-0">
          <span
            aria-hidden
            className="w-6 h-6 rounded-lg inline-block"
            style={{
              background: "linear-gradient(135deg, var(--accent) 0%, var(--coral) 100%)",
              boxShadow: "0 4px 12px -4px rgba(91,110,245,0.6)",
            }}
          />
          <span className="font-display font-bold text-[15px] tracking-tight">Minggle&nbsp;Terrain</span>
        </Link>

        <nav className="flex items-center gap-0.5 text-sm flex-1 overflow-x-auto whitespace-nowrap">
          {LINKS.map((l) => {
            const active =
              l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className="px-3 py-1.5 rounded-full transition-colors"
                style={{
                  color: active ? "var(--accent)" : "var(--text-secondary)",
                  background: active ? "var(--accent-soft)" : "transparent",
                  fontWeight: active ? 650 : 450,
                }}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={logout}
          className="text-xs shrink-0 px-3 py-1.5 rounded-full transition-colors hover:underline"
          style={{ color: "var(--text-muted)" }}
        >
          Déconnexion
        </button>
      </div>
    </header>
  );
}
