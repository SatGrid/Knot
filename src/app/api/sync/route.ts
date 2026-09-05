import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const memberships = await prisma.conversationMember.findMany({
    where: { userId: session.user.id },
    select: { conversationId: true, conversation: { select: { updatedAt: true, members: { select: { user: { select: { updatedAt: true } } } } } } },
  });
  const conversationIds = memberships.map(({ conversationId }) => conversationId);
  if (!conversationIds.length) return Response.json({ signature: "empty" });

  const [messages, reactions] = await Promise.all([
    prisma.message.aggregate({ where: { conversationId: { in: conversationIds } }, _count: true, _max: { updatedAt: true } }),
    prisma.messageReaction.aggregate({ where: { message: { conversationId: { in: conversationIds } } }, _count: true, _max: { createdAt: true } }),
  ]);
  const latestConversation = Math.max(...memberships.map(({ conversation }) => conversation.updatedAt.getTime()));
  const latestProfile = Math.max(...memberships.flatMap(({ conversation }) => conversation.members.map(({ user }) => user.updatedAt.getTime())));
  const signature = [latestConversation, latestProfile, messages._count, messages._max.updatedAt?.getTime() ?? 0, reactions._count, reactions._max.createdAt?.getTime() ?? 0].join(":");

  return Response.json({ signature });
}
