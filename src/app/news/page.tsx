import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getBrand } from "@/lib/brand";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const brand = await getBrand();
  return {
    title: `Actualités — ${brand.name}`,
    description: `Les dernières actualités de ${brand.name}.`,
  };
}

export default async function NewsPage() {
  const [posts, brand] = await Promise.all([
    prisma.post.findMany({
      where: { status: "published" },
      orderBy: { publishedAt: "desc" },
      select: { slug: true, title: true, excerpt: true, publishedAt: true },
    }),
    getBrand(),
  ]);

  return (
    <main className="min-h-screen p-6 sm:p-10">
      <div className="max-w-2xl mx-auto">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-semibold mb-2">Actualités {brand.name}</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Nouveautés, astuces et coulisses de l&apos;application.
          </p>
        </header>

        {posts.length === 0 ? (
          <p className="text-center text-sm" style={{ color: "var(--text-muted)" }}>
            Aucun article publié pour le moment — revenez bientôt !
          </p>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/news/${post.slug}`}
                className="card block overflow-hidden hover:opacity-90 transition-opacity"
              >
                {/* Visuel de marque du post : chaque article a le sien */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/og/${post.slug}`}
                  alt=""
                  loading="lazy"
                  className="w-full block"
                  style={{ aspectRatio: "1200 / 630", objectFit: "cover" }}
                />
                <div className="p-6">
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
                </div>
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
