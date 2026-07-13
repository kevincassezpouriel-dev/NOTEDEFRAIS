import { NextRequest, NextResponse } from "next/server";
import { recyclePost } from "@/lib/posts";

export const dynamic = "force-dynamic";

/** Recycle un post (rediffusion evergreen) : nouveau brouillon, visuel neuf. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const post = await recyclePost(id);
    return NextResponse.json(post, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Post introuvable" }, { status: 404 });
  }
}
