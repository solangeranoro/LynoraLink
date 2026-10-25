import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const accountSettingsSchema = z.object({
  notifications: z.object({
    projectUpdates: z.boolean(),
    messages: z.boolean(),
    productNews: z.boolean(),
  }).strict().optional(),
  preferredLang: z.enum(["EN", "FR"]).optional(),
}).strict().refine((settings) => settings.notifications !== undefined || settings.preferredLang !== undefined);

type NotificationSettings = {
  notifyProjectUpdates: boolean;
  notifyMessages: boolean;
  notifyProductNews: boolean;
};

function toNotifications(settings: NotificationSettings) {
  return {
    projectUpdates: settings.notifyProjectUpdates,
    messages: settings.notifyMessages,
    productNews: settings.notifyProductNews,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const settings = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { notifyProjectUpdates: true, notifyMessages: true, notifyProductNews: true, preferredLang: true },
  });
  if (!settings) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ notifications: toNotifications(settings), preferredLang: settings.preferredLang });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = accountSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_settings" }, { status: 400 });

  const settings = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(parsed.data.notifications ? {
        notifyProjectUpdates: parsed.data.notifications.projectUpdates,
        notifyMessages: parsed.data.notifications.messages,
        notifyProductNews: parsed.data.notifications.productNews,
      } : {}),
      ...(parsed.data.preferredLang ? { preferredLang: parsed.data.preferredLang } : {}),
    },
    select: { notifyProjectUpdates: true, notifyMessages: true, notifyProductNews: true, preferredLang: true },
  });

  return NextResponse.json({ notifications: toNotifications(settings), preferredLang: settings.preferredLang });
}