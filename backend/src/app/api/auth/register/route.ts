import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators";
import { sendTwoFactorCodeEmail } from "@/lib/email";
import { issueTwoFactorCode } from "@/lib/two-factor";
import { createWelcomeNotification } from "@/lib/notifications";

export async function POST(req: Request) {
  try {
    const parsed = registerSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION", issues: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }

    const {
      name,
      email,
      password,
      preferredLang,
      age,
      city,
      phoneNumber,
      handle,
      headline,
      bio,
      skills,
      githubUrl,
      twitterUrl,
    } = parsed.data;
    const normalizedEmail = email;
    if (await prisma.user.findUnique({ where: { email: normalizedEmail } })) {
      return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });
    }

    let finalHandle =
      handle && handle.length >= 3
        ? handle.toLowerCase()
        : normalizedEmail.split("@")[0].replace(/[^a-z0-9]/gi, "").slice(0, 20) || "maker";
    if (finalHandle.length < 3) finalHandle = `maker${Math.floor(Math.random() * 9000) + 1000}`;
    if (await prisma.user.findUnique({ where: { handle: finalHandle } })) {
      if (handle) return NextResponse.json({ error: "HANDLE_TAKEN" }, { status: 409 });
      finalHandle = `${finalHandle}${Math.floor(Math.random() * 9000) + 1000}`;
    }

    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash: await bcrypt.hash(password, 10),
        preferredLang,
        handle: finalHandle,
        headline: headline || null,
        age: age ?? null,
        city: city || null,
        phoneNumber: phoneNumber || null,
        bio: bio || null,
        skills: skills ?? [],
        githubUrl: githubUrl || null,
        twitterUrl: twitterUrl || null,
      },
    });

    try {
      await createWelcomeNotification(user.id);
    } catch (error) {
      console.error("Welcome notification failed:", error);
    }

    let challenge: Awaited<ReturnType<typeof issueTwoFactorCode>> | undefined;
    let emailSent = false;
    try {
      challenge = await issueTwoFactorCode(user.id, "REGISTER");
      await sendTwoFactorCodeEmail({
        to: normalizedEmail,
        name,
        code: challenge.code,
        purpose: "registration",
        locale: preferredLang,
      });
      emailSent = true;
    } catch {
      if (challenge) await prisma.twoFactorChallenge.deleteMany({ where: { id: challenge.id } });
      console.error("Registration verification email failed");
    }
    return NextResponse.json({ ok: true, userId: user.id, handle: finalHandle, emailSent }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = error.meta?.target;
      const fields = Array.isArray(target) ? target : typeof target === "string" ? [target] : [];
      if (fields.includes("email")) return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });
      if (fields.includes("handle")) return NextResponse.json({ error: "HANDLE_TAKEN" }, { status: 409 });
    }
    console.error("Register error:", error);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}