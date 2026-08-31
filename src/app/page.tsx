import { ChatShell, type ConversationView } from "./chat-shell";
import { DEMO_USER_ID } from "@/lib/demo-user";
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
  const memberships = await prisma.conversationMember.findMany({
    where: { userId: DEMO_USER_ID },
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

  const conversations: ConversationView[] = memberships.map(({ conversation }) => {
    const otherMember = conversation.members.find(({ userId }) => userId !== DEMO_USER_ID);
    const name = conversation.title ?? otherMember?.user.displayName ?? "Conversation";

    return {
      id: conversation.id,
      name,
      status: conversation.isGroup ? `${conversation.members.length} members` : "Online",
      time: formatTime(conversation.updatedAt),
      messages: conversation.messages.map((message) => ({
        id: message.id,
        body: message.body,
        sender: message.senderId === DEMO_USER_ID ? "me" : "them",
      })),
    };
  });

  return <ChatShell initialConversations={conversations} />;
}
