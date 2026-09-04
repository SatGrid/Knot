"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishRealtimeUpdate } from "@/lib/realtime";

async function notifyConversationMembers(conversationId: string, details?: { senderName?: string; messagePreview?: string }) {
  const members = await prisma.conversationMember.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  publishRealtimeUpdate(members.map(({ userId }) => userId), { conversationId, ...details });
}

export async function sendMessage(conversationId: string, formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("You must be signed in to send messages.");

  const body = String(formData.get("message") ?? "").trim();
  const replyToId = String(formData.get("replyToId") ?? "").trim() || null;
  const attachmentUrl = String(formData.get("attachmentUrl") ?? "").trim() || null;
  const attachmentName = String(formData.get("attachmentName") ?? "").trim() || null;
  const attachmentType = String(formData.get("attachmentType") ?? "").trim() || null;
  const attachmentSize = Number(formData.get("attachmentSize") ?? 0) || null;

  if ((!body && !attachmentUrl) || body.length > 4000) {
    throw new Error("Add a message or attachment before sending.");
  }
  if (attachmentUrl && !attachmentUrl.startsWith("/uploads/")) throw new Error("Invalid attachment.");

  const membership = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: session.user.id,
      },
    },
    select: { conversationId: true },
  });

  if (!membership) {
    throw new Error("You do not have access to this conversation.");
  }

  const blocked = await prisma.userBlock.findFirst({ where: { OR: [{ blockerId: session.user.id, blockedId: { in: (await prisma.conversationMember.findMany({ where: { conversationId, userId: { not: session.user.id } }, select: { userId: true } })).map(({ userId }) => userId) } }, { blockedId: session.user.id, blockerId: { in: (await prisma.conversationMember.findMany({ where: { conversationId, userId: { not: session.user.id } }, select: { userId: true } })).map(({ userId }) => userId) } }] } });
  if (blocked) throw new Error("Messages cannot be sent in this conversation.");

  if (replyToId) {
    const repliedMessage = await prisma.message.findFirst({
      where: { id: replyToId, conversationId, deletedAt: null },
      select: { id: true },
    });
    if (!repliedMessage) throw new Error("The message you replied to is no longer available.");
  }

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        conversationId,
        senderId: session.user.id,
        body,
        replyToId,
        attachmentUrl,
        attachmentName,
        attachmentType,
        attachmentSize,
      },
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    return created;
  });

  revalidatePath("/");
  await notifyConversationMembers(conversationId, { senderName: session.user.name, messagePreview: body || attachmentName || "Sent an attachment" });
  return { id: message.id, body: message.body, createdAt: message.createdAt.toISOString() };
}

export async function editMessage(messageId: string, body: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("You must be signed in to edit messages.");
  const cleanBody = body.trim();
  if (!cleanBody || cleanBody.length > 4000) throw new Error("A message must contain between 1 and 4,000 characters.");

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { senderId: true, conversationId: true, deletedAt: true },
  });
  if (!message || message.deletedAt) throw new Error("This message no longer exists.");
  if (message.senderId !== session.user.id) throw new Error("You can only edit your own messages.");

  await prisma.message.update({
    where: { id: messageId },
    data: { body: cleanBody, editedAt: new Date() },
  });
  revalidatePath("/");
  await notifyConversationMembers(message.conversationId);
}

export async function deleteMessage(messageId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("You must be signed in to delete messages.");

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { senderId: true, conversationId: true, deletedAt: true },
  });
  if (!message || message.deletedAt) throw new Error("This message no longer exists.");
  if (message.senderId !== session.user.id) throw new Error("You can only delete your own messages.");

  await prisma.message.update({
    where: { id: messageId },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/");
  await notifyConversationMembers(message.conversationId);
}

export async function toggleMessageReaction(messageId: string, emoji: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("You must be signed in to react to messages.");
  if (!["👍", "❤️", "😂", "😮", "😢", "🔥"].includes(emoji)) throw new Error("Unsupported reaction.");

  const message = await prisma.message.findFirst({
    where: { id: messageId, deletedAt: null, conversation: { members: { some: { userId: session.user.id } } } },
    select: { conversationId: true },
  });
  if (!message) throw new Error("This message is unavailable.");

  const key = { messageId_userId_emoji: { messageId, userId: session.user.id, emoji } };
  const existing = await prisma.messageReaction.findUnique({ where: key, select: { messageId: true } });
  if (existing) await prisma.messageReaction.delete({ where: key });
  else await prisma.messageReaction.create({ data: { messageId, userId: session.user.id, emoji } });

  revalidatePath("/");
  await notifyConversationMembers(message.conversationId);
}

export async function updateProfile(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("You must be signed in to update your profile.");

  const displayName = String(formData.get("displayName") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const avatarUrl = String(formData.get("avatarUrl") ?? "").trim() || null;
  if (displayName.length < 2 || displayName.length > 50) throw new Error("Name must be between 2 and 50 characters.");
  if (username && !/^[a-z0-9_]{3,20}$/.test(username)) throw new Error("Username must be 3–20 characters using letters, numbers, or underscores.");
  if (avatarUrl && (!avatarUrl.startsWith("data:image/") || avatarUrl.length > 8_000_000)) throw new Error("That photo could not be saved.");

  try {
    await prisma.user.update({ where: { id: session.user.id }, data: { displayName, username: username || null, avatarUrl } });
  } catch {
    throw new Error("That username is already taken.");
  }
  const contacts = await prisma.conversationMember.findMany({
    where: { conversation: { members: { some: { userId: session.user.id } } }, userId: { not: session.user.id } },
    select: { userId: true },
  });
  publishRealtimeUpdate([...new Set(contacts.map(({ userId }) => userId))], { conversationId: "profile" });
  revalidatePath("/");
}

export async function toggleMessagePin(messageId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("You must be signed in.");
  const message = await prisma.message.findFirst({ where: { id: messageId, conversation: { members: { some: { userId: session.user.id } } } }, select: { conversationId: true } });
  if (!message) throw new Error("Message not found.");
  const key = { messageId_userId: { messageId, userId: session.user.id } };
  const existing = await prisma.messagePin.findUnique({ where: key });
  if (existing) await prisma.messagePin.delete({ where: key });
  else await prisma.messagePin.create({ data: { messageId, userId: session.user.id } });
  revalidatePath("/");
}

export async function forwardMessage(messageId: string, conversationId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("You must be signed in.");
  const [source, target] = await Promise.all([
    prisma.message.findFirst({ where: { id: messageId, deletedAt: null, conversation: { members: { some: { userId: session.user.id } } } } }),
    prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId: session.user.id } } }),
  ]);
  if (!source || !target) throw new Error("Unable to forward this message.");
  await prisma.message.create({ data: { conversationId, senderId: session.user.id, body: source.body, attachmentUrl: source.attachmentUrl, attachmentName: source.attachmentName, attachmentType: source.attachmentType, attachmentSize: source.attachmentSize } });
  await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
  revalidatePath("/");
  await notifyConversationMembers(conversationId, { senderName: session.user.name, messagePreview: source.body || source.attachmentName || "Forwarded an attachment" });
}

export async function toggleBlockUser(userId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || userId === session.user.id) throw new Error("Invalid contact.");
  const key = { blockerId_blockedId: { blockerId: session.user.id, blockedId: userId } };
  const existing = await prisma.userBlock.findUnique({ where: key });
  if (existing) await prisma.userBlock.delete({ where: key });
  else await prisma.userBlock.create({ data: { blockerId: session.user.id, blockedId: userId } });
  revalidatePath("/");
}

export async function removeConversation(conversationId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("You must be signed in.");
  await prisma.conversationMember.delete({ where: { conversationId_userId: { conversationId, userId: session.user.id } } });
  revalidatePath("/");
}

export async function startConversationByEmail(email: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("You must be signed in to start a conversation.");
  const target = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true, displayName: true } });
  if (!target) throw new Error("No Knot user found with that email.");
  if (target.id === session.user.id) throw new Error("You cannot start a conversation with yourself.");
  const conversation = await prisma.conversation.create({ data: { members: { create: [{ userId: session.user.id }, { userId: target.id }] } } });
  revalidatePath("/");
  publishRealtimeUpdate([session.user.id, target.id], { conversationId: conversation.id });
  return { id: conversation.id, name: target.displayName };
}

export async function renameConversation(conversationId: string, title: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("You must be signed in to rename a conversation.");

  const cleanTitle = title.trim();
  if (cleanTitle.length < 1 || cleanTitle.length > 80) {
    throw new Error("Conversation names must be between 1 and 80 characters.");
  }

  const membership = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: session.user.id,
      },
    },
    select: { conversationId: true },
  });

  if (!membership) throw new Error("You do not have access to this conversation.");

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { title: cleanTitle },
  });

  revalidatePath("/");
  await notifyConversationMembers(conversationId);
  return { title: cleanTitle };
}

export async function updateConversationPreference(
  conversationId: string,
  preference: "archived" | "muted" | "unread",
  enabled: boolean,
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("You must be signed in to update a conversation.");

  const data = preference === "archived"
    ? { archivedAt: enabled ? new Date() : null }
    : preference === "muted"
      ? { mutedAt: enabled ? new Date() : null }
      : { lastReadAt: enabled ? null : new Date() };

  await prisma.conversationMember.update({
    where: {
      conversationId_userId: {
        conversationId,
        userId: session.user.id,
      },
    },
    data,
  });

  revalidatePath("/");
  await notifyConversationMembers(conversationId);
}
