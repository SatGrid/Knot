"use server";

import { revalidatePath } from "next/cache";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { prisma } from "@/lib/prisma";

export async function sendMessage(conversationId: string, formData: FormData) {
  const body = String(formData.get("message") ?? "").trim();

  if (!body || body.length > 4000) {
    throw new Error("A message must contain between 1 and 4,000 characters.");
  }

  const membership = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: DEMO_USER_ID,
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
        senderId: DEMO_USER_ID,
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

