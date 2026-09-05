import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { publishRealtimeUpdate, subscribeToRealtimeUpdates } from "@/lib/realtime";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const write = (value: string) => {
        if (!closed) controller.enqueue(encoder.encode(value));
      };
      write("event: connected\ndata: {}\n\n");

      const unsubscribe = subscribeToRealtimeUpdates(session.user.id, (event) => {
        write(`data: ${JSON.stringify(event)}\n\n`);
      });
      const heartbeat = setInterval(() => write(": heartbeat\n\n"), 25000);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      };
      request.signal.addEventListener("abort", close, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { conversationId, isTyping } = await request.json() as { conversationId?: string; isTyping?: boolean };
  if (!conversationId) return new Response("Invalid request", { status: 400 });
  const members = await prisma.conversationMember.findMany({ where: { conversationId }, select: { userId: true } });
  if (!members.some(({ userId }) => userId === session.user.id)) return new Response("Forbidden", { status: 403 });
  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId: session.user.id } },
    data: { typingUntil: isTyping ? new Date(Date.now() + 3000) : null },
  });
  publishRealtimeUpdate(members.filter(({ userId }) => userId !== session.user.id).map(({ userId }) => userId), {
    type: "typing",
    conversationId,
    userName: session.user.name,
    isTyping: Boolean(isTyping),
  });
  return new Response(null, { status: 204 });
}
