import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify, validateSlug } from "@/lib/validate";
import { createPost } from "@/lib/posts";
import { postPerformance } from "@/lib/attribution";

export const dynamic = "force-dynamic";

export async function GET() {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      qrCode: { select: { id: true, name: true, slug: true } },
      campaign: { select: { id: true, name: true } },
    },
  });
  // Attribution : clics et installs par post
  const perf = await postPerformance(posts.map((p) => p.utmSource ?? "").filter(Boolean));
  return NextResponse.json(
    posts.map((p) => ({
      ...p,
      clicks: p.utmSource ? perf.get(p.utmSource)?.clicks ?? 0 : 0,
      installs: p.utmSource ? perf.get(p.utmSource)?.installs ?? 0 : 0,
    }))
  );
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    title?: string;
    content?: string;
    excerpt?: string;
    hashtags?: string;
    qrCodeId?: string;
    campaignId?: string;
  } | null;

  if (!body?.title?.trim() || !body?.content?.trim()) {
    return NextResponse.json({ error: "Titre et contenu obligatoires" }, { status: 400 });
  }

  const slug = slugify(body.title);
  const slugError = validateSlug(slug);
  if (slugError) return NextResponse.json({ error: slugError }, { status: 400 });

  const post = await createPost({
    title: body.title.trim(),
    slug,
    content: body.content,
    excerpt: body.excerpt?.trim() || null,
    hashtags: body.hashtags?.trim() || null,
    qrCodeId: body.qrCodeId || null,
    campaignId: body.campaignId || null,
  });
  return NextResponse.json(post, { status: 201 });
}
