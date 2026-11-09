"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, Mail, Send, ShieldCheck } from "@/components/FontAwesomeIcons";
import { InfoPageShell } from "@/components/InfoPageShell";
import { useTranslation } from "@/lib/i18n";

const DEFAULT_SUPPORT_EMAIL = "contact@lynoralink.com";

export default function ContactPage() {
  const { locale } = useTranslation();
  const isFrench = locale === "fr";
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "", website: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error" | "unavailable">("idle");
  const [supportEmail, setSupportEmail] = useState(DEFAULT_SUPPORT_EMAIL);
  const [acknowledgementSent, setAcknowledgementSent] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/contact")
      .then(async (response) => {
        if (!response.ok) throw new Error("contact_details_unavailable");
        return response.json() as Promise<{ supportEmail?: string }>;
      })
      .then((result) => {
        if (active && result.supportEmail) setSupportEmail(result.supportEmail);
      })
      .catch((error: unknown) => {
        console.error("Could not load LynoraLink support contact details:", error);
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, locale: isFrench ? "FR" : "EN" }),
      });
      if (response.ok) {
        const result = await response.json() as { acknowledgementSent?: boolean };
        setAcknowledgementSent(Boolean(result.acknowledgementSent));
        setStatus("sent");
        setForm({ name: "", email: "", subject: "", message: "", website: "" });
      } else if (response.status === 503) {
        setStatus("unavailable");
      } else {
        console.error("Contact form submission failed:", response.status);
        setStatus("error");
      }
    } catch (error) {
      console.error("Contact form request failed:", error);
      setStatus("error");
    }
  }

  function updateForm(field: "name" | "email" | "subject" | "message" | "website", value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    if (status === "sent" || status === "error" || status === "unavailable") setStatus("idle");
  }

  return (
    <InfoPageShell
      eyebrow={isFrench ? "Assistance LynoraLink" : "LynoraLink support"}
      title={isFrench ? "Comment pouvons-nous vous aider ?" : "How can we help?"}
      description={isFrench ? "Écrivez à notre équipe pour une question, un retour ou un problème. Votre demande sera transmise directement au support." : "Contact our team with a question, feedback, or an issue. Your request will be sent directly to support."}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <form onSubmit={submit} className="space-y-5 rounded-2xl border border-[#d9e5ea] bg-white p-5 shadow-[0_16px_50px_rgba(20,39,58,0.08)] sm:p-7">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="contact-name" className="mb-1.5 block text-sm font-medium text-[#14273a]">{isFrench ? "Nom complet" : "Full name"}</label>
              <input id="contact-name" required minLength={2} maxLength={100} autoComplete="name" value={form.name} onChange={(event) => updateForm("name", event.target.value)} className="w-full rounded-xl border border-[#c4d6df] bg-white px-3.5 py-3 text-sm text-[#14273a] outline-none transition placeholder:text-[#8193a1] focus:border-[#087d82] focus:ring-2 focus:ring-[#087d82]/15" placeholder={isFrench ? "Votre nom" : "Your name"} />
            </div>
            <div>
              <label htmlFor="contact-email" className="mb-1.5 block text-sm font-medium text-[#14273a]">{isFrench ? "Adresse e-mail" : "Email address"}</label>
              <input id="contact-email" required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} className="w-full rounded-xl border border-[#c4d6df] bg-white px-3.5 py-3 text-sm text-[#14273a] outline-none transition placeholder:text-[#8193a1] focus:border-[#087d82] focus:ring-2 focus:ring-[#087d82]/15" placeholder={isFrench ? "vous@exemple.com" : "you@example.com"} />
            </div>
          </div>
          <div>
            <label htmlFor="contact-subject" className="mb-1.5 block text-sm font-medium text-[#14273a]">{isFrench ? "Objet" : "Subject"}</label>
            <input id="contact-subject" required minLength={3} maxLength={150} value={form.subject} onChange={(event) => updateForm("subject", event.target.value)} className="w-full rounded-xl border border-[#c4d6df] bg-white px-3.5 py-3 text-sm text-[#14273a] outline-none transition placeholder:text-[#8193a1] focus:border-[#087d82] focus:ring-2 focus:ring-[#087d82]/15" placeholder={isFrench ? "En quelques mots" : "A short summary"} />
          </div>
          <div>
            <label htmlFor="contact-message" className="mb-1.5 block text-sm font-medium text-[#14273a]">{isFrench ? "Votre message" : "Your message"}</label>
            <textarea id="contact-message" required minLength={10} maxLength={5000} rows={7} value={form.message} onChange={(event) => updateForm("message", event.target.value)} className="w-full resize-y rounded-xl border border-[#c4d6df] bg-white px-3.5 py-3 text-sm leading-6 text-[#14273a] outline-none transition placeholder:text-[#8193a1] focus:border-[#087d82] focus:ring-2 focus:ring-[#087d82]/15" placeholder={isFrench ? "Décrivez votre demande avec autant de détails que nécessaire…" : "Tell us how we can help…"} />
            <p className="mt-1.5 text-right text-xs text-[#8193a1]">{form.message.length}/5000</p>
          </div>
          <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
            <label htmlFor="contact-website">Website</label>
            <input id="contact-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => updateForm("website", event.target.value)} />
          </div>
          {status !== "idle" && (
            <div role={status === "sent" ? "status" : status === "sending" ? "status" : "alert"} aria-live="polite" className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-sm leading-5 ${status === "sent" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : status === "sending" ? "border-[#d9e5ea] bg-[#f5f8fa] text-[#526779]" : "border-red-200 bg-red-50 text-red-800"}`}>
              {status === "sent" ? <Check size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> : status === "sending" ? <LoaderCircle size={16} className="mt-0.5 shrink-0 animate-spin" aria-hidden="true" /> : null}
              <span>
                {status === "sending" && (isFrench ? "Envoi sécurisé de votre message…" : "Sending your message securely…")}
                {status === "sent" && (acknowledgementSent
                  ? (isFrench ? "Votre message a bien été transmis au support. Un accusé de réception a été envoyé à votre adresse e-mail." : "Your message has been delivered to support. A confirmation has been sent to your email address.")
                  : (isFrench ? "Votre message a bien été transmis au support. Vous pouvez nous répondre à " : "Your message has been delivered to support. You can reach us at "))}
                {status === "sent" && !acknowledgementSent && <a className="font-semibold underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>}
                {status === "unavailable" && (isFrench ? "Le support est momentanément indisponible. Écrivez-nous directement à " : "Support is temporarily unavailable. Email us directly at ")}
                {status === "unavailable" && <a className="font-semibold underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>}
                {status === "error" && (isFrench ? "Votre message n’a pas pu être envoyé. Réessayez ou écrivez-nous directement à " : "Your message could not be sent. Please try again or email us directly at ")}
                {status === "error" && <a className="font-semibold underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>}
              </span>
            </div>
          )}
          <div className="flex flex-col gap-3 border-t border-[#e6edf0] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-xs leading-5 text-[#718391]">
              <ShieldCheck size={15} className="shrink-0 text-[#087d82]" aria-hidden="true" />
              {isFrench ? "Vos coordonnées servent uniquement à répondre à votre demande." : "Your details are used only to respond to your request."}
            </p>
            <button type="submit" disabled={status === "sending"} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#086f58] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#075f4d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087d82] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">
              {status === "sending" ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
              {status === "sending" ? (isFrench ? "Envoi en cours…" : "Sending…") : (isFrench ? "Envoyer au support" : "Send to support")}
            </button>
          </div>
        </form>
        <aside className="h-fit rounded-2xl border border-[#d9e5ea] bg-gradient-to-br from-white to-[#f2f8f7] p-5 shadow-[0_16px_50px_rgba(20,39,58,0.06)] sm:p-6">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#087d82]/10 text-[#087d82]"><Mail size={20} aria-hidden="true" /></span>
          <h2 className="mt-4 font-display text-lg font-semibold text-[#14273a]">{isFrench ? "Contacter le support" : "Contact support"}</h2>
          <p className="mt-2 text-sm leading-6 text-[#526779]">{isFrench ? "Vous préférez votre messagerie ? Écrivez-nous directement. Les réponses à nos e-mails arrivent dans cette même boîte." : "Prefer using your email app? Contact us directly. Replies to our messages will arrive in the same inbox."}</p>
          <a href={`mailto:${supportEmail}`} className="mt-4 inline-flex max-w-full items-center gap-2 break-all text-sm font-semibold text-[#087d82] transition hover:text-[#075f4d]">
            <span className="break-all">{supportEmail}</span><Mail size={14} className="shrink-0" aria-hidden="true" />
          </a>
          <div className="mt-5 border-t border-[#d9e5ea] pt-4 text-xs leading-5 text-[#718391]">
            {isFrench ? "Chaque demande reçue via le formulaire fait l’objet d’un accusé de réception par e-mail." : "Every message sent through this form receives an email confirmation."}
          </div>
        </aside>
      </div>
    </InfoPageShell>
  );
}