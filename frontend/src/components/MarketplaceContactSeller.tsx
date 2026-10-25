"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { LoaderCircle, MessageCircle, Send, UserRound, X } from "@/components/FontAwesomeIcons";

type MarketplaceContactSellerProps = {
  listingId: string;
  listingTitle: string;
  sellerId: string;
  sellerName: string | null;
  sellerImage: string | null;
  isFrench: boolean;
  compact?: boolean;
};

export function MarketplaceContactSeller({ listingId, listingTitle, sellerId, sellerName, sellerImage, isFrench, compact = false }: MarketplaceContactSellerProps) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState(isFrench
    ? `Bonjour, je vous contacte au sujet de votre annonce « ${listingTitle} ». Pouvez-vous m’en dire plus ?`
    : `Hello, I'm contacting you about your listing “${listingTitle}”. Could you tell me more?`);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  if (sessionStatus === "authenticated" && session?.user?.id === sellerId) return null;

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = message.trim();
    if (content.length < 10 || sending) return;
    if (!session?.user?.id) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/marketplace/${listingId}`)}`);
      return;
    }

    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/marketplace/items/${encodeURIComponent(listingId)}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "contact_failed");
      router.push(`/messages?conversationId=${encodeURIComponent(result.conversationId)}`);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      setError(code === "LISTING_NOT_AVAILABLE"
        ? (isFrench ? "Cette annonce n’est plus disponible." : "This listing is no longer available.")
        : code === "OWN_LISTING"
          ? (isFrench ? "Vous ne pouvez pas vous contacter vous-même." : "You cannot contact yourself.")
          : (isFrench ? "Message non envoyé. Réessayez." : "Message not sent. Try again."));
      setSending(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => { if (sessionStatus !== "authenticated") { router.push(`/login?callbackUrl=${encodeURIComponent(`/marketplace/${listingId}`)}`); return; } setIsOpen(true); setError(""); }} disabled={sessionStatus === "loading"} className={compact ? "btn-outline w-full justify-center !rounded-lg !px-2 !py-2 text-xs" : "btn-outline w-full justify-center !rounded-xl"}>
        <MessageCircle size={compact ? 14 : 16} aria-hidden="true" />{compact ? (isFrench ? "Contacter" : "Contact") : (isFrench ? "Contacter le vendeur" : "Contact seller")}
      </button>
      {isOpen && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !sending) setIsOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="contact-seller-title" aria-describedby="contact-seller-listing" onKeyDown={(event) => { if (event.key === "Escape" && !sending) setIsOpen(false); }} className="w-full max-w-lg border border-midnight-border bg-midnight-card p-5 shadow-2xl sm:p-6">
          <header className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-soft">Marketplace</p><h2 id="contact-seller-title" className="mt-2 text-lg font-semibold text-ink">{isFrench ? "Contacter le vendeur" : "Contact the seller"}</h2><p id="contact-seller-listing" className="mt-1 line-clamp-2 text-sm text-ink-muted">{listingTitle}</p></div>
            <button type="button" onClick={() => setIsOpen(false)} disabled={sending} aria-label={isFrench ? "Fermer" : "Close"} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-muted transition hover:bg-midnight-deep hover:text-ink"><X size={18} aria-hidden="true" /></button>
          </header>
          <div className="mt-5 flex items-center gap-3 border-y border-midnight-border py-3">
            {sellerImage ? <img src={sellerImage} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-midnight-deep text-gold-soft"><UserRound size={18} aria-hidden="true" /></span>}
            <div className="min-w-0"><p className="text-xs text-ink-muted">{isFrench ? "Votre message sera envoyé à" : "Your message will be sent to"}</p><p className="truncate text-sm font-medium text-ink">{sellerName || (isFrench ? "Le vendeur" : "The seller")}</p></div>
          </div>
          <form onSubmit={sendMessage} className="mt-5 space-y-4">
            <label className="block"><span className="label">{isFrench ? "Votre message" : "Your message"}</span><textarea autoFocus required minLength={10} maxLength={4000} rows={6} value={message} onChange={(event) => setMessage(event.target.value)} className="input resize-y" /><span className="mt-1 flex justify-between text-xs text-ink-muted"><span>{isFrench ? "10 caractères minimum" : "10 characters minimum"}</span><span>{message.length}/4000</span></span></label>
            {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2 border-t border-midnight-border pt-4"><button type="button" onClick={() => setIsOpen(false)} disabled={sending} className="btn-ghost !rounded-xl">{isFrench ? "Annuler" : "Cancel"}</button><button type="submit" disabled={sending || message.trim().length < 10} className="btn-gold !rounded-xl">{sending ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}{sending ? (isFrench ? "Envoi…" : "Sending…") : (isFrench ? "Envoyer le message" : "Send message")}</button></div>
          </form>
        </section>
      </div>}
    </>
  );
}