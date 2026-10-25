"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowRight, ArrowUpRight, LoaderCircle, Mail, PackagePlus, ShoppingBag, Store } from "@/components/FontAwesomeIcons";
import { MarketplaceSellWizard } from "@/components/MarketplaceSellWizard";
import { MarketplacePayoutNotice } from "@/components/MarketplacePayoutNotice";
import { MarketplaceVerificationWizard } from "@/components/MarketplaceVerificationWizard";
import { useTranslation } from "@/lib/i18n";
import { formatUsd } from "@/lib/utils";

type MarketItem = {
  id: string;
  title: string;
  description: string;
  type: "TEMPLATE" | "MICRO_SAAS" | "SERVICE";
  priceCents: number;
  currency: string;
  isActive: boolean;
  isFeatured: boolean;
  moderationStatus?: "PENDING" | "APPROVED" | "REJECTED";
  imageUrl: string | null;
  sellerId: string;
  seller: { name: string | null; handle: string | null; image: string | null };
};
type Order = { id: string; amountCents: number; paidAt: string | null; item: { id: string; title: string; deliveryUrl: string | null } };
type MarketTab = "browse" | "sell" | "purchases";
type BillingPeriod = "monthly" | "yearly";
type VerificationData = {
  isVerified: boolean;
  isAdminExempt: boolean;
  accountEmail: string | null;
  accountEmailVerified: boolean;
  verification: null | {
    status: string;
    hasSubscription: boolean;
    email: string;
    emailVerifiedAt: string | null;
    emailTokenExpiresAt: string;
    currentPeriodEnd: string | null;
  };
};

export default function MarketplacePage() {
  const { locale } = useTranslation();
  const isFrench = locale === "fr";
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<MarketTab>("browse");
  const [showVerificationForm, setShowVerificationForm] = useState(false);
  const [sellerCheckoutPending, setSellerCheckoutPending] = useState(false);
  const [sellerCheckoutError, setSellerCheckoutError] = useState("");
  const [resendingVerification, setResendingVerification] = useState(false);
  const [resendFeedback, setResendFeedback] = useState<{ message: string; isError: boolean } | null>(null);
  const verification = useQuery({
    queryKey: ["marketplace-verification"],
    queryFn: async () => {
      const response = await fetch("/api/marketplace/verification");
      if (!response.ok) throw new Error("billing_status_failed");
      return response.json() as Promise<VerificationData>;
    },
  });
  const canSell = verification.data?.isVerified ?? false;
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") !== "sell") return;
    setTab("sell");
    if (!verification.data || verification.data.isVerified) return;
    const current = verification.data.verification;
    const expiredEmailLink = current?.status === "pending_email" &&
      new Date(current.emailTokenExpiresAt) <= new Date();
    if (!current || expiredEmailLink) setShowVerificationForm(true);
  }, [verification.data]);
  async function subscribeSeller(period: BillingPeriod) {
    setSellerCheckoutPending(true);
    setSellerCheckoutError("");
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "marketplace_verification", period }),
      });
      const result = await response.json() as {
        transactionId?: string;
        customerEmail?: string;
        successUrl?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? `HTTP_${response.status}`);
      if (!result.transactionId || !result.customerEmail || !result.successUrl) {
        throw new Error("INVALID_PADDLE_CHECKOUT");
      }
      const { openPaddleCheckout } = await import("@/lib/paddle-checkout");
      await openPaddleCheckout(result.transactionId, result.customerEmail, result.successUrl);
    } catch (error) {
      console.error("Unable to start seller verification subscription:", error);
      const code = error instanceof Error ? error.message : "";
      setSellerCheckoutError(code === "PADDLE_MARKETPLACE_NOT_APPROVED"
        ? (isFrench ? "Les abonnements vendeur attendent l’approbation de Paddle." : "Seller subscriptions are awaiting Paddle approval.")
        : code === "BILLING_NOT_CONFIGURED" || code === "PADDLE_CLIENT_NOT_CONFIGURED"
          ? (isFrench ? "Les paiements Paddle ne sont pas configurés." : "Paddle payments are not configured.")
          : (isFrench ? "Impossible de démarrer l’abonnement. Réessayez." : "Could not start the subscription. Please try again."));
      setSellerCheckoutPending(false);
    }
  }
  async function manageSellerSubscription() {
    setSellerCheckoutPending(true);
    setSellerCheckoutError("");
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "marketplace_verification" }),
      });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error ?? `HTTP_${response.status}`);
      window.location.assign(result.url);
    } catch (error) {
      console.error("Unable to open seller subscription portal:", error);
      setSellerCheckoutError(isFrench
        ? "Impossible d’ouvrir la gestion de l’abonnement vendeur."
        : "Could not open seller subscription management.");
      setSellerCheckoutPending(false);
    }
  }
  async function resendVerificationEmail() {
    setResendingVerification(true);
    setResendFeedback(null);
    try {
      const response = await fetch("/api/marketplace/verification/resend", { method: "POST" });
      const result = await response.json().catch(() => null) as { error?: string; retryAfter?: number } | null;
      if (!response.ok) {
        const message = result?.error === "VERIFICATION_RESEND_RATE_LIMITED"
          ? (isFrench
            ? `Veuillez patienter ${result.retryAfter ?? 60} secondes avant de renvoyer le lien.`
            : `Please wait ${result.retryAfter ?? 60} seconds before requesting another link.`)
          : result?.error === "EMAIL_DELIVERY_NOT_CONFIGURED"
            ? (isFrench ? "L’envoi réel des e-mails n’est pas configuré sur le serveur. Contactez l’assistance." : "Email delivery is not configured on the server. Contact support.")
            : (isFrench ? "Le renvoi de l’e-mail a échoué. Réessayez dans un instant." : "The email could not be resent. Please try again.");
        setResendFeedback({ message, isError: true });
        return;
      }
      setResendFeedback({
        message: isFrench
          ? "Nouvelle demande transmise au service e-mail. Vérifiez aussi vos courriers indésirables et l’onglet Promotions."
          : "A new request was handed to the email provider. Also check your spam folder and Promotions tab.",
        isError: false,
      });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-verification"] });
    } catch {
      setResendFeedback({
        message: isFrench ? "Impossible de contacter le service. Vérifiez votre connexion puis réessayez." : "Could not reach the service. Check your connection and try again.",
        isError: true,
      });
    } finally {
      setResendingVerification(false);
    }
  }
  const items = useQuery({
    queryKey: ["marketplace-items"],
    queryFn: async () => {
      const response = await fetch("/api/marketplace/items");
      if (!response.ok) throw new Error("items_failed");
      return (await response.json()).items as MarketItem[];
    },
  });
  const ownItems = useQuery({
    queryKey: ["marketplace-own-items"],
    enabled: tab === "sell" && canSell,
    queryFn: async () => {
      const response = await fetch("/api/marketplace/items?mine=1");
      if (!response.ok) throw new Error("own_items_failed");
      return (await response.json()).items as MarketItem[];
    },
  });
  const orders = useQuery({
    queryKey: ["marketplace-orders"],
    enabled: tab === "purchases",
    queryFn: async () => {
      const response = await fetch("/api/marketplace/orders");
      if (!response.ok) throw new Error("orders_failed");
      return (await response.json()).orders as Order[];
    },
  });
  function openSellerAccess() {
    setTab("sell");
    if (!canSell && !verification.data?.verification?.status) {
      setShowVerificationForm(true);
    } else if (
      !canSell &&
      verification.data?.verification?.status === "pending_email" &&
      new Date(verification.data.verification.emailTokenExpiresAt) <= new Date()
    ) {
      setShowVerificationForm(true);
    }
  }

  const tabs: { id: MarketTab; label: string; icon: typeof Store }[] = [
    { id: "browse", label: isFrench ? "Explorer" : "Browse", icon: Store },
    { id: "sell", label: isFrench ? "Vendre" : "Sell", icon: PackagePlus },
    { id: "purchases", label: isFrench ? "Mes achats" : "Purchases", icon: ShoppingBag },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-10">
      <header className="flex flex-col gap-4 border-b border-midnight-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-soft">{isFrench ? "Le savoir-faire des makers" : "Made by makers"}</p>
          <h1 className="section-title mt-2">{isFrench ? "Marketplace" : "Marketplace"}</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">{isFrench ? "Templates, micro-SaaS et services créés par la communauté." : "Templates, micro-SaaS, and services from the community."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs text-ink-muted">{isFrench ? "0 % de commission sur vos ventes." : "0% platform commission on sales."}</div>
          <button
            type="button"
            onClick={openSellerAccess}
            disabled={verification.isLoading}
            className="btn-primary shrink-0"
          >
            {verification.isLoading
              ? (isFrench ? "Vérification…" : "Checking status…")
              : canSell
                ? (isFrench ? "Accéder à l’espace vendeur" : "Open seller workspace")
                : verification.data?.verification?.emailVerifiedAt
                  ? (isFrench ? "Choisir un abonnement vendeur" : "Choose a seller plan")
                : verification.data?.verification?.status === "pending_email" &&
                    new Date(verification.data.verification.emailTokenExpiresAt) > new Date()
                    ? (isFrench ? "Vérifier mon e-mail" : "Check my email")
                    : (isFrench ? "Vérifier mon compte" : "Verify my account")}
          </button>
        </div>
      </header>

      <nav className="flex gap-1 border-b border-midnight-border" aria-label={isFrench ? "Marketplace" : "Marketplace"}>
        {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined} className={`inline-flex items-center gap-2 border-b-2 px-2 py-3 text-sm transition sm:px-3 ${tab === id ? "border-gold text-gold-soft" : "border-transparent text-ink-muted hover:text-ink"}`}><Icon size={16} aria-hidden="true" />{label}</button>)}
      </nav>

      {tab === "browse" && (
        <section aria-label={isFrench ? "Offres disponibles" : "Available listings"}>
          {items.isLoading ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="skeleton h-72" />)}</div>
            : items.isError ? <p role="alert" className="text-sm text-rose-300">{isFrench ? "Impossible de charger les offres." : "Couldn't load listings."}</p>
              : items.data?.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {items.data.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl border border-midnight-border bg-midnight-card/40 transition duration-200 hover:-translate-y-0.5 hover:border-gold/30 hover:shadow-card">
                  <Link href={`/marketplace/${encodeURIComponent(item.id)}`} aria-label={isFrench ? `Voir ${item.title}` : `View ${item.title}`} className="relative block aspect-[16/9] overflow-hidden border-b border-midnight-border bg-[linear-gradient(135deg,rgba(8,111,88,0.16),rgba(28,37,65,0.65))]">
                    {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-gold/70"><PackagePlus size={30} aria-hidden="true" /></div>}
                    <span className="absolute bottom-3 left-3 border border-white/15 bg-midnight-deep/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gold-soft">{item.type.replace("_", " ")}</span>
                    {item.isFeatured && <span className="absolute right-3 top-3 rounded-full border border-gold/40 bg-midnight-deep/90 px-2.5 py-1 text-[10px] font-semibold text-gold-soft">{isFrench ? "À la une" : "Featured"}</span>}
                  </Link>
                  <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3"><h2 className="font-display text-base font-semibold text-ink"><Link href={`/marketplace/${encodeURIComponent(item.id)}`} className="transition hover:text-gold-soft">{item.title}</Link></h2><span className="shrink-0 text-sm font-semibold text-gold-soft">{formatUsd(item.priceCents / 100, isFrench ? "fr-FR" : "en-US")}</span></div>
                    <p className="line-clamp-3 min-h-12 text-xs leading-relaxed text-ink-muted">{item.description}</p>
                    <div className="flex items-center justify-between gap-3 border-t border-midnight-border pt-3">
                      <span className="truncate text-xs text-ink-muted">{item.seller.handle ? `@${item.seller.handle}` : item.seller.name ?? (isFrench ? "Maker" : "Maker")}</span>
                      <Link href={`/marketplace/${encodeURIComponent(item.id)}`} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-ink-muted transition hover:text-gold-soft">{isFrench ? "Détails" : "Details"}<ArrowRight size={13} aria-hidden="true" /></Link>
                    </div>
                  </div>
                </article>)}
              </div> : <p className="border-y border-midnight-border py-10 text-center text-sm text-ink-muted">{isFrench ? "Aucune offre pour le moment. Soyez le premier à partager votre travail." : "No listings yet. Be the first to share your work."}</p>}
        </section>
      )}

      {tab === "sell" && <section className="space-y-6">
        {verification.isError ? (
          <div className="mx-auto max-w-2xl border-y border-midnight-border py-8 text-center">
            <p role="alert" className="text-sm text-rose-300">
              {isFrench ? "Impossible de vérifier votre accès vendeur." : "Couldn't check your seller access."}
            </p>
            <button type="button" onClick={() => void verification.refetch()} className="btn-ghost mt-4">
              {isFrench ? "Réessayer" : "Try again"}
            </button>
          </div>
        ) : !canSell ? (
          <div className="mx-auto max-w-2xl border-y border-gold/30 py-10 text-center">
            <Store className="mx-auto h-8 w-8 text-gold" aria-hidden="true" />
            <h2 className="mt-4 font-display text-xl font-semibold text-ink">
              {isFrench ? "Vente réservée aux comptes vérifiés" : "Selling is for verified accounts"}
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-ink-muted">
              {verification.isLoading
                ? (isFrench ? "Chargement de votre statut vendeur…" : "Loading your seller status…")
                : verification.data?.verification?.status === "pending_email"
                  ? (isFrench
                    ? `Une demande de confirmation a été transmise à ${verification.data.verification.email}. Vérifiez votre boîte de réception, ainsi que les courriers indésirables et l’onglet Promotions.`
                    : `A confirmation request was handed to ${verification.data.verification.email}. Check your inbox, spam folder, and Promotions tab.`)
                  : verification.data?.accountEmailVerified === false
                    ? (isFrench
                      ? "Complétez le formulaire vendeur : le lien envoyé à l’adresse de votre compte confirmera aussi votre adresse e-mail."
                      : "Complete the seller form. The link sent to your account email will also confirm your email address.")
                  : isFrench
                    ? "La vérification vendeur nécessite une adresse e-mail confirmée et un abonnement : 15 $ par mois ou 180 $ par an. Aucune commission n’est prélevée sur vos ventes."
                    : "Seller verification requires a confirmed email and a subscription: $15 per month or $180 per year. No platform commission is taken from your sales."}
            </p>
            {verification.data?.verification?.status === "pending_email" ? (
              <div className="mx-auto mt-5 max-w-lg">
                <button type="button" onClick={() => void resendVerificationEmail()} disabled={resendingVerification} className="btn-primary inline-flex items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-60">
                  {resendingVerification ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Mail size={15} aria-hidden="true" />}
                  {resendingVerification
                    ? (isFrench ? "Renvoi en cours…" : "Resending…")
                    : (isFrench ? "Je n’ai rien reçu — renvoyer le lien" : "Didn't receive it? Resend link")}
                </button>
                {resendFeedback && <p role={resendFeedback.isError ? "alert" : "status"} className={`mt-3 text-sm ${resendFeedback.isError ? "text-rose-300" : "text-emerald-300"}`}>{resendFeedback.message}</p>}
              </div>
            ) : verification.data?.verification?.emailVerifiedAt ? (
              <div className="mx-auto mt-6 max-w-xl">
                {!verification.data.verification.hasSubscription && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void subscribeSeller("monthly")}
                      disabled={sellerCheckoutPending || verification.isLoading}
                      className="rounded-2xl border border-midnight-border bg-midnight-card/70 p-5 text-left transition hover:border-gold/50 hover:bg-gold/5 disabled:cursor-wait disabled:opacity-60"
                    >
                      <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{isFrench ? "Mensuel" : "Monthly"}</span>
                      <span className="mt-2 block text-2xl font-semibold text-ink">$15<span className="text-sm font-normal text-ink-muted"> / {isFrench ? "mois" : "month"}</span></span>
                      <span className="mt-2 block text-xs text-ink-muted">{isFrench ? "Facturé chaque mois, annulable via Paddle." : "Billed monthly; manage or cancel through Paddle."}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void subscribeSeller("yearly")}
                      disabled={sellerCheckoutPending || verification.isLoading}
                      className="rounded-2xl border border-gold/40 bg-gold/5 p-5 text-left transition hover:bg-gold/10 disabled:cursor-wait disabled:opacity-60"
                    >
                      <span className="text-xs font-semibold uppercase tracking-wide text-gold-soft">{isFrench ? "Annuel" : "Yearly"}</span>
                      <span className="mt-2 block text-2xl font-semibold text-ink">$180<span className="text-sm font-normal text-ink-muted"> / {isFrench ? "an" : "year"}</span></span>
                      <span className="mt-2 block text-xs text-ink-muted">{isFrench ? "Facturé une fois par an." : "Billed once per year."}</span>
                    </button>
                  </div>
                )}
                {verification.data.verification.hasSubscription && (
                  <button
                    type="button"
                    onClick={() => void manageSellerSubscription()}
                    disabled={sellerCheckoutPending}
                    className="btn-ghost mt-4 w-full justify-center disabled:cursor-wait disabled:opacity-60"
                  >
                    {isFrench ? "Gérer mon abonnement vendeur dans Paddle" : "Manage seller subscription in Paddle"}
                  </button>
                )}
                {sellerCheckoutPending && <p role="status" className="mt-3 text-sm text-ink-muted">{isFrench ? "Ouverture de la fenêtre de paiement Paddle…" : "Opening Paddle checkout…"}</p>}
                {sellerCheckoutError && <p role="alert" className="mt-3 text-sm text-rose-300">{sellerCheckoutError}</p>}
              </div>
            ) : (
              <button type="button" onClick={() => setShowVerificationForm(true)} className="btn-primary mt-5">
                {isFrench ? "Vérifier mon compte" : "Verify my account"}
              </button>
            )}
            {showVerificationForm && verification.data?.accountEmail && (
              <MarketplaceVerificationWizard
                isFrench={isFrench}
                email={verification.data.accountEmail}
                onCancel={() => setShowVerificationForm(false)}
                onSubmitted={() => {
                  setShowVerificationForm(false);
                  void queryClient.invalidateQueries({ queryKey: ["marketplace-verification"] });
                }}
              />
            )}
          </div>
        ) : <>
          {verification.data?.isAdminExempt && (
            <p className="border-y border-sky-400/30 py-3 text-sm text-sky-200">
              {isFrench
                ? "Compte administrateur vérifié automatiquement."
                : "Platform administrator account is automatically verified."}
            </p>
          )}
          <MarketplacePayoutNotice isFrench={isFrench} />
          {!verification.data?.verification?.hasSubscription && !verification.data?.isAdminExempt && (
            <div className="mb-6 rounded-xl border border-midnight-border bg-midnight-card/40 p-4">
              <p className="text-sm font-semibold text-ink">
                {isFrench ? "Abonnement de vérification vendeur" : "Seller verification subscription"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                {isFrench
                  ? "Votre accès actuel reste inchangé. Vous pouvez choisir l’offre mensuelle à 15 $ ou annuelle à 180 $."
                  : "Your current access remains unchanged. You can choose the $15 monthly or $180 yearly plan."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void subscribeSeller("monthly")} disabled={sellerCheckoutPending} className="btn-ghost disabled:cursor-wait disabled:opacity-60">
                  {isFrench ? "15 $ / mois" : "$15 / month"}
                </button>
                <button type="button" onClick={() => void subscribeSeller("yearly")} disabled={sellerCheckoutPending} className="btn-ghost disabled:cursor-wait disabled:opacity-60">
                  {isFrench ? "180 $ / an" : "$180 / year"}
                </button>
              </div>
              {sellerCheckoutPending && <p role="status" className="mt-2 text-sm text-ink-muted">{isFrench ? "Ouverture de Paddle…" : "Opening Paddle…"}</p>}
              {sellerCheckoutError && <p role="alert" className="mt-2 text-sm text-rose-300">{sellerCheckoutError}</p>}
            </div>
          )}
          {verification.data?.verification?.hasSubscription && (
            <div className="mb-6">
              <button
                type="button"
                onClick={() => void manageSellerSubscription()}
                disabled={sellerCheckoutPending}
                className="btn-ghost disabled:cursor-wait disabled:opacity-60"
              >
                {isFrench ? "Gérer ou annuler mon abonnement vendeur" : "Manage or cancel seller subscription"}
              </button>
              {sellerCheckoutPending && <p role="status" className="mt-2 text-sm text-ink-muted">{isFrench ? "Ouverture de Paddle…" : "Opening Paddle…"}</p>}
              {sellerCheckoutError && <p role="alert" className="mt-2 text-sm text-rose-300">{sellerCheckoutError}</p>}
            </div>
          )}
          <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
            <MarketplaceSellWizard initialLanguage={isFrench ? "fr" : "en"} onPublished={() => {
              void Promise.all([
                queryClient.invalidateQueries({ queryKey: ["marketplace-items"] }),
                queryClient.invalidateQueries({ queryKey: ["marketplace-own-items"] }),
              ]);
            }} />
            <section className="min-w-0 border-t border-midnight-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0" aria-labelledby="your-listings-title">
              <h2 id="your-listings-title" className="text-base font-semibold text-ink">{isFrench ? "Vos offres" : "Your listings"}</h2>
              {ownItems.isLoading ? <div className="mt-3 space-y-3" aria-busy="true" aria-label={isFrench ? "Chargement des annonces" : "Loading listings"}><div className="skeleton h-10 w-full" /><div className="skeleton h-10 w-full" /><div className="skeleton h-10 w-full" /></div> : ownItems.data?.length ? <ul className="mt-3 divide-y divide-midnight-border">{ownItems.data.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-3"><span className="min-w-0 truncate text-sm text-ink">{item.title}</span><span className="flex shrink-0 items-center gap-3"><span className="text-xs text-gold-soft">{formatUsd(item.priceCents / 100, isFrench ? "fr-FR" : "en-US")}</span><span className={`text-[10px] ${item.moderationStatus === "APPROVED" ? "text-emerald-300" : item.moderationStatus === "REJECTED" ? "text-rose-300" : "text-amber-300"}`}>{item.moderationStatus === "APPROVED" ? (isFrench ? "Publiée" : "Published") : item.moderationStatus === "REJECTED" ? (isFrench ? "Refusée" : "Rejected") : (isFrench ? "En attente" : "Pending review")}</span></span></li>)}</ul> : ownItems.isError ? <p role="alert" className="mt-3 text-sm text-rose-300">{isFrench ? "Impossible de charger vos offres." : "Couldn't load your listings."}</p> : <p className="mt-3 text-sm text-ink-muted">{isFrench ? "Aucune offre soumise." : "No listings submitted."}</p>}
            </section>
          </div>
        </>}
      </section>}

      {tab === "purchases" && <section aria-label={isFrench ? "Achats confirmés" : "Completed purchases"}>
        {orders.isLoading ? <ul className="divide-y divide-midnight-border border-y border-midnight-border" aria-busy="true" aria-label={isFrench ? "Chargement des achats" : "Loading purchases"}>{Array.from({ length: 3 }).map((_, index) => <li key={index} className="flex flex-wrap items-center justify-between gap-4 py-4"><div className="space-y-2"><div className="skeleton h-4 w-48" /><div className="skeleton h-3 w-32" /></div><div className="skeleton h-9 w-32" /></li>)}</ul> : orders.isError ? <p role="alert" className="text-sm text-rose-300">{isFrench ? "Impossible de charger vos achats." : "Couldn't load your purchases."}</p> : orders.data?.length ? <ul className="divide-y divide-midnight-border border-y border-midnight-border">{orders.data.map((order) => <li key={order.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><p className="text-sm font-medium text-ink">{order.item.title}</p><p className="mt-1 text-xs text-ink-muted">{order.paidAt ? new Date(order.paidAt).toLocaleDateString(locale) : ""} · {formatUsd(order.amountCents / 100, isFrench ? "fr-FR" : "en-US")}</p></div>{order.item.deliveryUrl && <a href={order.item.deliveryUrl} target="_blank" rel="noreferrer" className="btn-ghost !rounded-lg !px-3 !py-2 text-xs"><ArrowDownToLine size={14} aria-hidden="true" />{isFrench ? "Accéder" : "Open purchase"}<ArrowUpRight size={13} aria-hidden="true" /></a>}</li>)}</ul> : <p className="border-y border-midnight-border py-10 text-center text-sm text-ink-muted">{isFrench ? "Vos achats confirmés apparaîtront ici." : "Your completed purchases will appear here."}</p>}
      </section>}
    </div>
  );
}