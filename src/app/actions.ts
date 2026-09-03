"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function sendMessage(conversationId: string, formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("You must be signed in to send messages.");

  const body = String(formData.get("message") ?? "").trim();

  if (!body || body.length > 4000) {
    throw new Error("A message must contain between 1 and 4,000 characters.");
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

  if (!membership) {
    throw new Error("You do not have access to this conversation.");
  }

  await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        senderId: session.user.id,
        body,
      },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);

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
  return { id: conversation.id, name: target.displayName };
}
