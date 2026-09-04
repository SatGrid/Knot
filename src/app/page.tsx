import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ChatShell, type ConversationView } from "./chat-shell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatTime(date: Date) {
  const today = new Date();

  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(date);
  }

  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const currentUserId = session.user.id;
  const memberships = await prisma.conversationMember.findMany({
    where: { userId: currentUserId },
    orderBy: { conversation: { updatedAt: "desc" } },
    include: {
      conversation: {
        include: {
          members: { include: { user: true } },
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
            include: { sender: true },
          },
        },
      },
    },
  });

  const conversations: ConversationView[] = memberships.map(({ conversation, archivedAt, mutedAt, lastReadAt }) => {
    const otherMember = conversation.members.find(({ userId }) => userId !== currentUserId);
    const name = conversation.title ?? otherMember?.user.displayName ?? "Conversation";

    return {
      id: conversation.id,
      name,
      status: conversation.isGroup ? `${conversation.members.length} members` : "Online",
      time: formatTime(conversation.updatedAt),
      archived: Boolean(archivedAt),
      muted: Boolean(mutedAt),
      unread: lastReadAt === null,
      messages: conversation.messages.map((message) => ({
        id: message.id,
        body: message.body,
        sender: message.senderId === currentUserId ? "me" : "them",
      })),
    };
  });

  return <ChatShell currentUserName={session.user.name} initialConversations={conversations} />;
}
