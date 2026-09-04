import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishRealtimeUpdate } from "@/lib/realtime";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });
  const now = new Date();
  await prisma.user.update({ where: { id: session.user.id }, data: { lastSeenAt: now } });
  const contacts = await prisma.conversationMember.findMany({
    where: { conversation: { members: { some: { userId: session.user.id } } }, userId: { not: session.user.id } },
    select: { userId: true },
  });
  publishRealtimeUpdate([...new Set(contacts.map(({ userId }) => userId))], { type: "presence", conversationId: "presence", userId: session.user.id, isOnline: true });
  return new Response(null, { status: 204 });
}
