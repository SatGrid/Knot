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

function formatPresence(lastSeenAt?: Date | null) {
  if (!lastSeenAt) return "Offline";
  const seconds = Math.floor((Date.now() - lastSeenAt.getTime()) / 1000);
  if (seconds < 60) return "Online";
  if (seconds < 3600) return `Last seen ${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `Last seen ${Math.floor(seconds / 3600)}h ago`;
  return `Last seen ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(lastSeenAt)}`;
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
            include: { sender: true, reactions: true, replyTo: { select: { id: true, body: true, senderId: true, deletedAt: true } } },
          },
        },
      },
    },
  });

  const conversations: ConversationView[] = memberships.map(({ conversation, archivedAt, mutedAt, lastReadAt }) => {
    const otherMember = conversation.members.find(({ userId }) => userId !== currentUserId);
    const name = conversation.title ?? otherMember?.user.displayName ?? "Conversation";
    const latestIncomingMessage = conversation.messages.filter(({ senderId }) => senderId !== currentUserId).at(-1);

    return {
      id: conversation.id,
      name,
      status: conversation.isGroup ? `${conversation.members.length} members` : formatPresence(otherMember?.user.lastSeenAt),
      participantId: otherMember?.userId ?? null,
      avatarUrl: otherMember?.user.avatarUrl ?? null,
      time: formatTime(conversation.updatedAt),
      archived: Boolean(archivedAt),
      muted: Boolean(mutedAt),
      unread: Boolean(latestIncomingMessage && (!lastReadAt || latestIncomingMessage.createdAt > lastReadAt)),
      messages: conversation.messages.map((message) => ({
        id: message.id,
        body: message.body,
        sender: message.senderId === currentUserId ? "me" : "them",
        time: new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(message.createdAt),
        delivery: message.senderId === currentUserId
          ? conversation.members.some(({ userId, lastReadAt }) => userId !== currentUserId && lastReadAt && lastReadAt >= message.createdAt) ? "Read" as const : "Sent" as const
          : undefined,
        edited: Boolean(message.editedAt),
        attachment: message.attachmentUrl ? {
          url: message.attachmentUrl,
          name: message.attachmentName ?? "Attachment",
          type: message.attachmentType ?? "application/octet-stream",
          size: message.attachmentSize ?? 0,
        } : undefined,
        replyTo: message.replyTo && !message.replyTo.deletedAt ? {
          id: message.replyTo.id,
          body: message.replyTo.body,
          sender: message.replyTo.senderId === currentUserId ? "You" : name,
        } : undefined,
        reactions: Object.values(Object.groupBy(message.reactions, ({ emoji }) => emoji)).map((items) => ({
          emoji: items![0].emoji,
          count: items!.length,
          reacted: items!.some(({ userId }) => userId === currentUserId),
        })),
      })),
    };
  });

  const currentUser = await prisma.user.findUniqueOrThrow({ where: { id: currentUserId }, select: { displayName: true, username: true, avatarUrl: true } });
  return <ChatShell currentUserAvatar={currentUser.avatarUrl} currentUserName={currentUser.displayName} currentUsername={currentUser.username} initialConversations={conversations} />;
}
