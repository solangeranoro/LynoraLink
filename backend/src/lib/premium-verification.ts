import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { appUrl, emailLayout, sendEmail } from "@/lib/email";

const TOKEN_LIFETIME_MS = 48 * 60 * 60 * 1000;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export async function sendPremiumVerificationEmail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      preferredLang: true,
      isVerified: true,
      emailVerified: true,
      subscription: { select: { plan: true, status: true, expiresAt: true } },
    },
  });
  const subscription = user?.subscription;
  if (
    !user ||
    (user.isVerified && user.emailVerified) ||
    subscription?.plan !== "PREMIUM" ||
    subscription.status !== "active" ||
    (subscription.expiresAt && subscription.expiresAt <= new Date())
  ) return;

  const identifier = `premium-verification:${user.id}`;
  const existingToken = await prisma.verificationToken.findFirst({
    where: { identifier, userId: user.id, expires: { gt: new Date() } },
    orderBy: { expires: "desc" },
    select: { token: true },
  });
  const token = existingToken?.token ?? randomBytes(32).toString("hex");
  if (!existingToken) {
    await prisma.verificationToken.create({
      data: { identifier, token, userId: user.id, expires: new Date(Date.now() + TOKEN_LIFETIME_MS) },
    });
  }

  const french = user.preferredLang === "FR";
  const name = escapeHtml(user.name ?? "Maker");
  const link = `${appUrl()}/api/auth/verify?token=${encodeURIComponent(token)}`;
  const subject = french ? "Confirmez votre compte LynoraLink Premium" : "Verify your LynoraLink Premium account";
  const title = french ? "Confirmez votre compte" : "Verify your account";
  const greeting = french ? `Bonjour ${name},` : `Hello ${name},`;
  const explanation = french
    ? "Votre abonnement Premium est actif. Confirmez votre adresse e-mail pour recevoir le badge vérifié sur votre profil et vos publications."
    : "Your Premium subscription is active. Confirm your email address to receive the verified badge on your profile and posts.";
  const button = french ? "Confirmer mon compte" : "Verify my account";
  const expiry = french ? "Ce lien expire dans 48 heures et ne peut être utilisé qu’une fois." : "This link expires in 48 hours and can only be used once.";
  const html = `
    <h1 style="margin:0 0 18px;color:#f8fafc;font-size:23px;line-height:1.3">${title}</h1>
    <p style="margin:0 0 12px">${greeting}</p>
    <p style="margin:0 0 24px">${explanation}</p>
    <p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="display:inline-block;padding:13px 22px;border-radius:9px;background-color:#12a98c;color:#071120;text-decoration:none;font-weight:700">${button}</a></p>
    <p style="margin:0 0 12px">${expiry}</p>
    <p style="margin:0;color:#9db0c0;font-size:13px">${french ? "Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail." : "If you didn't request this, you can ignore this email."}</p>`;
  const text = `${greeting}\n\n${explanation}\n${link}\n\n${expiry}`;

  try {
    const brevoApiKey = process.env.BREVO_API_KEY;
    const brevoSenderEmail = process.env.BREVO_FROM_EMAIL;
    if (brevoApiKey && brevoSenderEmail) {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevoApiKey, "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: { email: brevoSenderEmail, name: process.env.BREVO_FROM_NAME ?? "LynoraLink" },
          to: [{ email: user.email }],
          subject,
          htmlContent: emailLayout(html, french ? "FR" : "EN"),
          textContent: text,
        }),
      });
      if (!response.ok) throw new Error(`Brevo email request failed with status ${response.status}`);
    } else {
      const result = await sendEmail({ to: user.email, subject, html, text, locale: french ? "FR" : "EN" });
      if (!result.ok) throw new Error("premium_verification_email_send_failed");
    }
  } catch (error) {
    if (!existingToken) {
      await prisma.verificationToken.deleteMany({ where: { identifier, token } });
    }
    throw error;
  }
}
