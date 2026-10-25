import { NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/email";

const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  subject: z.string().trim().min(3).max(150),
  message: z.string().trim().min(10).max(5000),
  website: z.string().max(200).optional().default(""),
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

  const recipient = process.env.CONTACT_EMAIL;
  if (!recipient) return NextResponse.json({ error: "contact_unavailable" }, { status: 503 });

  const { name, email, subject, message } = parsed.data;
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message);
  const result = await sendEmail({
    to: recipient,
    replyTo: email,
    subject: `[LynoraLink] ${subject.replace(/[\r\n]+/g, " ")}`,
    html: `<h2>New contact message</h2><p><strong>From:</strong> ${safeName} (${safeEmail})</p><p><strong>Subject:</strong> ${safeSubject}</p><p style="white-space:pre-wrap">${safeMessage}</p>`,
    text: `From: ${name} (${email})\nSubject: ${subject}\n\n${message}`,
  });

  if (!result.ok) return NextResponse.json({ error: "email_failed" }, { status: 502 });
  return NextResponse.json({ ok: true });
}