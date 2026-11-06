"use client";

import { useState } from "react";
import { InfoPageShell } from "@/components/InfoPageShell";
import { useTranslation } from "@/lib/i18n";

export default function ContactPage() {
  const { locale } = useTranslation();
  const isFrench = locale === "fr";
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "", website: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error" | "unavailable">("idle");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (response.ok) {
        setStatus("sent");
        setForm({ name: "", email: "", subject: "", message: "", website: "" });
      } else if (response.status === 503) {
        setStatus("unavailable");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <InfoPageShell
      eyebrow={isFrench ? "Parlons de votre projet" : "Let's talk about your project"}
      title={isFrench ? "Contactez LynoraLink" : "Contact LynoraLink"}
      description={isFrench ? "Une question, une suggestion ou un problème à signaler ? Envoyez un message à l’équipe." : "Have a question, suggestion, or issue to report? Send a message to the team."}
    >
      <form onSubmit={submit} className="space-y-5 rounded-md border border-[#d9e5ea] bg-white p-5 sm:p-7">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="contact-name" className="mb-1.5 block text-xs font-semibold uppercase text-[#526779]">{isFrench ? "Nom" : "Name"}</label>
            <input id="contact-name" required minLength={2} maxLength={100} autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-md border border-[#c4d6df] bg-white px-3 py-2.5 text-sm text-[#14273a] outline-none transition focus:border-[#087d82] focus:ring-2 focus:ring-[#087d82]/15" />
          </div>
          <div>
            <label htmlFor="contact-email" className="mb-1.5 block text-xs font-semibold uppercase text-[#526779]">{isFrench ? "Adresse email" : "Email address"}</label>
            <input id="contact-email" required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="w-full rounded-md border border-[#c4d6df] bg-white px-3 py-2.5 text-sm text-[#14273a] outline-none transition focus:border-[#087d82] focus:ring-2 focus:ring-[#087d82]/15" />
          </div>
        </div>
        <div>
          <label htmlFor="contact-subject" className="mb-1.5 block text-xs font-semibold uppercase text-[#526779]">{isFrench ? "Objet" : "Subject"}</label>
          <input id="contact-subject" required minLength={3} maxLength={150} value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} className="w-full rounded-md border border-[#c4d6df] bg-white px-3 py-2.5 text-sm text-[#14273a] outline-none transition focus:border-[#087d82] focus:ring-2 focus:ring-[#087d82]/15" />
        </div>
        <div>
          <label htmlFor="contact-message" className="mb-1.5 block text-xs font-semibold uppercase text-[#526779]">{isFrench ? "Message" : "Message"}</label>
          <textarea id="contact-message" required minLength={10} maxLength={5000} rows={6} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} className="w-full resize-y rounded-md border border-[#c4d6df] bg-white px-3 py-2.5 text-sm leading-6 text-[#14273a] outline-none transition focus:border-[#087d82] focus:ring-2 focus:ring-[#087d82]/15" />
        </div>
        <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
          <label htmlFor="contact-website">Website</label>
          <input id="contact-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} />
        </div>
        {status !== "idle" && (
          <p role="status" className={`text-sm ${status === "sent" ? "text-emerald-700" : status === "sending" ? "text-[#526779]" : "text-red-700"}`}>
            {status === "sending" && (isFrench ? "Envoi en cours…" : "Sending…")}
            {status === "sent" && (isFrench ? "Message envoyé. Merci de nous avoir contactés." : "Message sent. Thanks for reaching out.")}
            {status === "unavailable" && (isFrench ? "Le formulaire de contact n’est pas encore configuré. Réessayez plus tard." : "The contact form is not configured yet. Please try again later.")}
            {status === "error" && (isFrench ? "Envoi impossible. Vérifiez les champs et réessayez." : "Couldn't send your message. Check the fields and try again.")}
          </p>
        )}
        <button type="submit" disabled={status === "sending"} className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#086f58] px-5 text-sm font-semibold text-[#071827] transition hover:bg-[#0a795e] disabled:cursor-wait disabled:opacity-60">
          {status === "sending" ? (isFrench ? "Envoi…" : "Sending…") : (isFrench ? "Envoyer le message" : "Send message")}
        </button>
      </form>
    </InfoPageShell>
  );
}