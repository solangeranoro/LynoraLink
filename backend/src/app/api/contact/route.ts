import { NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/email";

const DEFAULT_SUPPORT_EMAIL = "contact@lynoralink.com";

const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  subject: z.string().trim().min(3).max(150),
  message: z.string().trim().min(10).max(5000),
  website: z.string().max(200).optional().default(""),
  locale: z.enum(["EN", "FR"]).default("EN"),
});

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function supportEmail() {
  const configuredEmail = process.env.CONTACT_EMAIL?.trim();
  if (!configuredEmail) return DEFAULT_SUPPORT_EMAIL;
  return z.string().email().safeParse(configuredEmail).success ? configuredEmail : null;
}

export async function GET() {
  const email = supportEmail();
  if (!email) return NextResponse.json({ error: "contact_unavailable" }, { status: 503 });
  return NextResponse.json({ supportEmail: email }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_contact" }, { status: 400 });
  }

  if (parsed.data.website) return NextResponse.json({ ok: true });

  const recipient = supportEmail();
  if (!recipient) {
    console.error("Contact form is unavailable because CONTACT_EMAIL is invalid.");
    return NextResponse.json({ error: "contact_unavailable" }, { status: 503 });
  }

  const { name, email, subject, message, locale } = parsed.data;
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message);
  const french = locale === "FR";
  let result: Awaited<ReturnType<typeof sendEmail>>;
  try {
    result = await sendEmail({
      to: recipient,
      replyTo: email,
      locale,
      subject: `[LynoraLink] ${subject.replace(/[\r\n]+/g, " ")}`,
      html: `
        <h1 style="margin:0 0 8px;color:#f8fafc;font-size:23px;line-height:1.3">${french ? "Nouveau message de contact" : "New contact message"}</h1>
        <p style="margin:0 0 24px;color:#9db0c0">${french ? "Un message a été envoyé depuis le formulaire de contact LynoraLink." : "A message was submitted through the LynoraLink contact form."}</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:20px">
          <tr><td style="padding:10px 0;border-bottom:1px solid #283d54;color:#9db0c0;width:110px">${french ? "Nom" : "Name"}</td><td style="padding:10px 0;border-bottom:1px solid #283d54;color:#f8fafc">${safeName}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #283d54;color:#9db0c0">${french ? "E-mail" : "Email"}</td><td style="padding:10px 0;border-bottom:1px solid #283d54"><a href="mailto:${safeEmail}" style="color:#8cff00;text-decoration:none">${safeEmail}</a></td></tr>
          <tr><td style="padding:10px 0;color:#9db0c0">${french ? "Objet" : "Subject"}</td><td style="padding:10px 0;color:#f8fafc">${safeSubject}</td></tr>
        </table>
        <div style="padding:18px;border:1px solid #283d54;border-radius:12px;background:#0d1a2a">
          <p style="margin:0 0 8px;color:#9db0c0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px">${french ? "Message" : "Message"}</p>
          <p style="margin:0;color:#f8fafc;white-space:pre-wrap;overflow-wrap:anywhere">${safeMessage}</p>
        </div>
        <p style="margin:20px 0 0;color:#9db0c0;font-size:13px">${french ? "Répondez directement à cet e-mail pour contacter l’expéditeur." : "Reply directly to this email to contact the sender."}</p>
      `,
      text: `${french ? "Nouveau message de contact LynoraLink" : "New LynoraLink contact message"}\n\n${french ? "Nom" : "Name"}: ${name}\n${french ? "E-mail" : "Email"}: ${email}\n${french ? "Objet" : "Subject"}: ${subject}\n\n${message}`,
    });
  } catch (error) {
    console.error("Contact form email delivery failed:", error);
    return NextResponse.json({ error: "email_failed" }, { status: 502 });
  }
  if (!result.ok) return NextResponse.json({ error: "email_failed" }, { status: 502 });
  if ("dev" in result && result.dev) {
    return NextResponse.json({ error: "email_not_configured" }, { status: 503 });
  }

  let acknowledgementSent = false;
  try {
    const acknowledgement = await sendEmail({
      to: email,
      replyTo: recipient,
      locale,
      subject: french ? "Nous avons bien reçu votre message | LynoraLink" : "We received your message | LynoraLink",
      html: `
        <h1 style="margin:0 0 14px;color:#f8fafc;font-size:23px;line-height:1.3">${french ? "Merci de nous avoir contactés." : "Thanks for contacting us."}</h1>
        <p style="margin:0 0 14px">${french ? "Votre message a bien été transmis à l’équipe LynoraLink. Nous reviendrons vers vous dès que possible." : "Your message has been delivered to the LynoraLink support team. We’ll get back to you as soon as possible."}</p>
        <div style="margin-top:22px;padding:16px;border-left:3px solid #8cff00;background:#0d1a2a">
          <p style="margin:0 0 6px;color:#9db0c0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px">${french ? "Votre demande" : "Your request"}</p>
          <p style="margin:0 0 8px;color:#f8fafc;font-weight:700">${safeSubject}</p>
          <p style="margin:0;color:#cbd5e1;white-space:pre-wrap;overflow-wrap:anywhere">${safeMessage}</p>
        </div>
        <p style="margin:22px 0 0;color:#9db0c0;font-size:13px">${french ? "Pour ajouter une précision, répondez directement à cet e-mail." : "If you need to add information, reply directly to this email."}</p>
      `,
      text: french
        ? `Bonjour ${name},\n\nNous avons bien reçu votre message au sujet de « ${subject} ». L’équipe LynoraLink vous répondra dès que possible.\n\nVotre message :\n${message}\n\n— L’équipe LynoraLink`
        : `Hello ${name},\n\nWe received your message about "${subject}". The LynoraLink team will reply as soon as possible.\n\nYour message:\n${message}\n\n— The LynoraLink team`,
    });
    if (!acknowledgement.ok) {
      console.error("Contact form acknowledgement could not be delivered:", acknowledgement.error);
    } else {
      acknowledgementSent = !("dev" in acknowledgement && acknowledgement.dev);
    }
  } catch (error) {
    console.error("Contact form acknowledgement failed:", error);
  }

  return NextResponse.json({ ok: true, acknowledgementSent });
}