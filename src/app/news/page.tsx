import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Actualités — MINGGLE",
  description: "Les dernières actualités de MINGGLE.",
};

export default async function NewsPage() {
  const posts = await prisma.post.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    select: { slug: true, title: true, excerpt: true, publishedAt: true },
  });

  return (
    <main className="min-h-screen p-6 sm:p-10">
      <div className="max-w-2xl mx-auto">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-semibold mb-2">Actualités MINGGLE</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Nouveautés, astuces et coulisses de l&apos;application.
          </p>
        </header>

        {posts.length === 0 ? (
          <p className="text-center text-sm" style={{ color: "var(--text-muted)" }}>
            Aucun article publié pour le moment — revenez bientôt !
          </p>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/news/${post.slug}`}
                className="card block p-6 hover:opacity-90 transition-opacity"
              >
                <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                  {post.publishedAt?.toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <h2 className="text-lg font-semibold mb-1">{post.title}</h2>
                {post.excerpt && (
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {post.excerpt}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}

        <p className="mt-12 text-center text-xs" style={{ color: "var(--text-muted)" }}>
          <Link href="/app" className="underline">
            Découvrir l&apos;application
          </Link>
        </p>
      </div>
    </main>
  );
}
