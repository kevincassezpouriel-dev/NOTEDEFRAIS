import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify, validateSlug } from "@/lib/validate";
import { uniquePostSlug } from "@/lib/posts";

export const dynamic = "force-dynamic";

export async function GET() {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    include: { qrCode: { select: { id: true, name: true, slug: true } } },
  });
  return NextResponse.json(posts);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    title?: string;
    content?: string;
    excerpt?: string;
    hashtags?: string;
    qrCodeId?: string;
  } | null;

  if (!body?.title?.trim() || !body?.content?.trim()) {
    return NextResponse.json({ error: "Titre et contenu obligatoires" }, { status: 400 });
  }

  const slug = await uniquePostSlug(slugify(body.title));
  const slugError = validateSlug(slug);
  if (slugError) return NextResponse.json({ error: slugError }, { status: 400 });

  const post = await prisma.post.create({
    data: {
      title: body.title.trim(),
      slug,
      content: body.content,
      excerpt: body.excerpt?.trim() || null,
      hashtags: body.hashtags?.trim() || null,
      qrCodeId: body.qrCodeId || null,
    },
  });
  return NextResponse.json(post, { status: 201 });
}
