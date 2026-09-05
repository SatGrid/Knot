import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ typing: false }, { status: 401 });

  const conversationId = new URL(request.url).searchParams.get("conversationId");
  if (!conversationId) return Response.json({ typing: false }, { status: 400 });

  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: session.user.id } },
    select: { conversationId: true },
  });
  if (!membership) return Response.json({ typing: false }, { status: 403 });

  const typingMember = await prisma.conversationMember.findFirst({
    where: { conversationId, userId: { not: session.user.id }, typingUntil: { gt: new Date() } },
    select: { user: { select: { displayName: true } } },
  });

  return Response.json({ typing: Boolean(typingMember), userName: typingMember?.user.displayName ?? null });
}
