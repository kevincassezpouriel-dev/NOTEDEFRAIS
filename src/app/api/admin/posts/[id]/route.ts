import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishPost } from "@/lib/posts";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    include: { qrCode: { select: { id: true, name: true, slug: true } } },
  });
  if (!post) return NextResponse.json({ error: "Post introuvable" }, { status: 404 });
  return NextResponse.json(post);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    title?: string;
    content?: string;
    excerpt?: string | null;
    hashtags?: string | null;
    qrCodeId?: string | null;
    status?: "draft" | "published";
  } | null;
  if (!body) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  try {
    // Publication : passe par publishPost pour déclencher le webhook social
    if (body.status === "published") {
      const current = await prisma.post.findUnique({ where: { id }, select: { status: true } });
      if (!current) return NextResponse.json({ error: "Post introuvable" }, { status: 404 });
      const { status: _ignored, ...rest } = body;
      if (Object.keys(rest).length > 0) {
        await prisma.post.update({ where: { id }, data: cleanData(rest) });
      }
      if (current.status !== "published") {
        return NextResponse.json(await publishPost(id, req.nextUrl.origin));
      }
      return NextResponse.json(await prisma.post.findUnique({ where: { id } }));
    }

    const post = await prisma.post.update({
      where: { id },
      data: {
        ...cleanData(body),
        ...(body.status === "draft" ? { status: "draft", publishedAt: null } : {}),
      },
    });
    return NextResponse.json(post);
  } catch {
    return NextResponse.json({ error: "Post introuvable" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.post.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Post introuvable" }, { status: 404 });
  }
}

function cleanData(body: {
  title?: string;
  content?: string;
  excerpt?: string | null;
  hashtags?: string | null;
  qrCodeId?: string | null;
}) {
  return {
    ...(body.title !== undefined ? { title: body.title.trim() } : {}),
    ...(body.content !== undefined ? { content: body.content } : {}),
    ...(body.excerpt !== undefined ? { excerpt: body.excerpt?.trim() || null } : {}),
    ...(body.hashtags !== undefined ? { hashtags: body.hashtags?.trim() || null } : {}),
    ...(body.qrCodeId !== undefined ? { qrCodeId: body.qrCodeId || null } : {}),
  };
}
