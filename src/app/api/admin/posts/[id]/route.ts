import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishPost } from "@/lib/posts";
import { logAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      qrCode: { select: { id: true, name: true, slug: true } },
      campaign: { select: { id: true, name: true } },
    },
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
    campaignId?: string | null;
    status?: "draft" | "published" | "scheduled";
    scheduledAt?: string | null;
  } | null;
  if (!body) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  const origin = process.env.APP_BASE_URL || req.nextUrl.origin;

  try {
    // Publication immédiate : passe par publishPost (webhook + timeline)
    if (body.status === "published") {
      const current = await prisma.post.findUnique({ where: { id }, select: { status: true } });
      if (!current) return NextResponse.json({ error: "Post introuvable" }, { status: 404 });
      const { status: _s, scheduledAt: _sa, ...rest } = body;
      if (Object.keys(rest).length > 0) {
        await prisma.post.update({ where: { id }, data: cleanData(rest) });
      }
      if (current.status !== "published") {
        return NextResponse.json(await publishPost(id, origin));
      }
      return NextResponse.json(await prisma.post.findUnique({ where: { id } }));
    }

    // Programmation
    if (body.status === "scheduled") {
      const when = body.scheduledAt ? new Date(body.scheduledAt) : null;
      if (!when || Number.isNaN(when.getTime()) || when.getTime() < Date.now()) {
        return NextResponse.json({ error: "Date de programmation invalide" }, { status: 400 });
      }
      const post = await prisma.post.update({
        where: { id },
        data: { ...cleanData(body), status: "scheduled", scheduledAt: when, publishedAt: null },
      });
      await logAction({
        type: "post.scheduled",
        title: `Post programmé : « ${post.title} »`,
        detail: `Publication prévue le ${when.toLocaleString("fr-FR")}.`,
        campaignId: post.campaignId,
        refType: "post",
        refId: post.id,
        status: "pending",
      });
      return NextResponse.json(post);
    }

    const post = await prisma.post.update({
      where: { id },
      data: {
        ...cleanData(body),
        ...(body.status === "draft" ? { status: "draft", publishedAt: null, scheduledAt: null } : {}),
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
  campaignId?: string | null;
}) {
  return {
    ...(body.title !== undefined ? { title: body.title.trim() } : {}),
    ...(body.content !== undefined ? { content: body.content } : {}),
    ...(body.excerpt !== undefined ? { excerpt: body.excerpt?.trim() || null } : {}),
    ...(body.hashtags !== undefined ? { hashtags: body.hashtags?.trim() || null } : {}),
    ...(body.qrCodeId !== undefined ? { qrCodeId: body.qrCodeId || null } : {}),
    ...(body.campaignId !== undefined ? { campaignId: body.campaignId || null } : {}),
  };
}
