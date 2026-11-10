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
      pageClassName="documentation-page contact-page"
      contentClassName="contact-content !max-w-none !space-y-0"
    >
      <div className="contact-layout">
        <form onSubmit={submit} className="contact-form">
          <header className="contact-form-heading">
            <span>{isFrench ? "FORMULAIRE DE CONTACT" : "CONTACT FORM"}</span>
            <h2>{isFrench ? "Envoyez-nous un message" : "Send us a message"}</h2>
            <p>{isFrench ? "Les champs marqués d’un astérisque sont obligatoires." : "Fields marked with an asterisk are required."}</p>
          </header>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="contact-name">{isFrench ? "Nom complet" : "Full name"} <span aria-hidden="true">*</span></label>
              <input id="contact-name" required minLength={2} maxLength={100} autoComplete="name" value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder={isFrench ? "Votre nom" : "Your name"} />
            </div>
            <div>
              <label htmlFor="contact-email">{isFrench ? "Adresse e-mail" : "Email address"} <span aria-hidden="true">*</span></label>
              <input id="contact-email" required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} placeholder={isFrench ? "vous@exemple.com" : "you@example.com"} />
            </div>
          </div>
          <div>
            <label htmlFor="contact-subject">{isFrench ? "Objet" : "Subject"} <span aria-hidden="true">*</span></label>
            <input id="contact-subject" required minLength={3} maxLength={150} value={form.subject} onChange={(event) => updateForm("subject", event.target.value)} placeholder={isFrench ? "En quelques mots" : "A short summary"} />
          </div>
          <div>
            <label htmlFor="contact-message">{isFrench ? "Votre message" : "Your message"} <span aria-hidden="true">*</span></label>
            <textarea id="contact-message" required minLength={10} maxLength={5000} rows={7} value={form.message} onChange={(event) => updateForm("message", event.target.value)} placeholder={isFrench ? "Décrivez votre demande avec autant de détails que nécessaire…" : "Tell us how we can help…"} />
            <p className="contact-character-count">{form.message.length}/5000</p>
          </div>
          <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
            <label htmlFor="contact-website">Website</label>
            <input id="contact-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => updateForm("website", event.target.value)} />
          </div>
          {status !== "idle" && (
            <div data-state={status} role={status === "sent" ? "status" : status === "sending" ? "status" : "alert"} aria-live="polite" className="contact-status">
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
          <div className="contact-form-footer">
            <p>
              <ShieldCheck size={15} aria-hidden="true" />
              {isFrench ? "Vos coordonnées servent uniquement à répondre à votre demande." : "Your details are used only to respond to your request."}
            </p>
            <button type="submit" disabled={status === "sending"} className="contact-submit">
              {status === "sending" ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
              {status === "sending" ? (isFrench ? "Envoi en cours…" : "Sending…") : (isFrench ? "Envoyer au support" : "Send to support")}
            </button>
          </div>
        </form>
        <aside className="contact-support">
          <span className="contact-support-icon"><Mail size={20} aria-hidden="true" /></span>
          <span className="contact-support-kicker">{isFrench ? "CONTACT DIRECT" : "DIRECT CONTACT"}</span>
          <h2>{isFrench ? "Contacter le support" : "Contact support"}</h2>
          <p>{isFrench ? "Vous préférez votre messagerie ? Écrivez-nous directement. Les réponses à nos e-mails arrivent dans cette même boîte." : "Prefer using your email app? Contact us directly. Replies to our messages will arrive in the same inbox."}</p>
          <a href={`mailto:${supportEmail}`}>
            <span className="break-all">{supportEmail}</span><Mail size={14} className="shrink-0" aria-hidden="true" />
          </a>
          <div className="contact-support-note">
            {isFrench ? "Chaque demande reçue via le formulaire fait l’objet d’un accusé de réception par e-mail." : "Every message sent through this form receives an email confirmation."}
          </div>
        </aside>
      </div>
    </InfoPageShell>
  );
}