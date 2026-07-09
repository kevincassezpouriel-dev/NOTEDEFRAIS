import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { renderMarkdown } from "@/lib/markdown";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const post = await prisma.post.findUnique({
    where: { slug },
    select: { title: true, excerpt: true },
  });
  return {
    title: post ? `${post.title} — MINGGLE` : "Article — MINGGLE",
    description: post?.excerpt ?? undefined,
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await prisma.post.findUnique({
    where: { slug },
    include: { qrCode: { select: { slug: true, type: true } } },
  });
  if (!post || post.status !== "published") notFound();

  // Attribution par post : la source = utm_source unique du post
  const src = post.utmSource ?? "site-news";
  const ctaHref = post.qrCode
    ? `/${post.qrCode.type === "link" ? "l" : "r"}/${post.qrCode.slug}?utm_source=${src}`
    : `/download?utm_source=${src}`;

  return (
    <main className="min-h-screen p-6 sm:p-10">
      <article className="max-w-2xl mx-auto">
        <Link href="/news" className="text-sm underline" style={{ color: "var(--text-muted)" }}>
          ← Toutes les actualités
        </Link>
        <h1 className="text-3xl font-semibold mt-4 mb-2">{post.title}</h1>
        <p className="text-xs mb-8" style={{ color: "var(--text-muted)" }}>
          {post.publishedAt?.toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>

        <div
          className="post-content text-[15px] leading-relaxed space-y-4
            [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-2
            [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2
            [&_ul]:list-disc [&_ul]:pl-6 [&_a]:underline"
          style={{ color: "var(--text-secondary)" }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
        />

        <div className="mt-10 text-center">
          <a href={ctaHref} className="btn btn-primary text-base px-6 py-3">
            📲 Télécharger MINGGLE
          </a>
        </div>

        {post.hashtags && (
          <p className="mt-8 text-sm" style={{ color: "var(--text-muted)" }}>
            {post.hashtags}
          </p>
        )}
      </article>
    </main>
  );
}
