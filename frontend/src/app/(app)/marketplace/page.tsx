"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, LoaderCircle, Mail, PackagePlus, ShoppingBag, Store } from "@/components/FontAwesomeIcons";
import { MarketplaceContactSeller } from "@/components/MarketplaceContactSeller";
import { MarketplaceSellWizard } from "@/components/MarketplaceSellWizard";
import { MarketplaceVerificationWizard } from "@/components/MarketplaceVerificationWizard";
import { useTranslation } from "@/lib/i18n";
import { formatUsd } from "@/lib/utils";
import { getNetworkErrorMessage } from "@/lib/error-messages";

type MarketItem = {
  id: string;
  title: string;
  description: string;
  type: "TEMPLATE" | "MICRO_SAAS" | "SERVICE";
  priceCents: number;
  currency: string;
  moderationStatus?: "PENDING" | "APPROVED" | "REJECTED";
  imageUrl: string | null;
  sellerId: string;
  seller: { id: string; name: string | null; handle: string | null; image: string | null };
};

type VerificationData = {
  isVerified: boolean;
  isAdminExempt: boolean;
  accountEmail: string | null;
  accountEmailVerified: boolean;
  verification: null | {
    status: string;
    email: string;
    emailVerifiedAt: string | null;
    emailTokenExpiresAt: string;
  };
};

type MarketTab = "browse" | "sell";

export default function MarketplacePage() {
  const { locale } = useTranslation();
  const isFrench = locale === "fr";
  const { data: session, status: sessionStatus } = useSession();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<MarketTab>("browse");
  const [showVerificationForm, setShowVerificationForm] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [resendFeedback, setResendFeedback] = useState<{ message: string; isError: boolean } | null>(null);

  const verification = useQuery({
    queryKey: ["marketplace-verification"],
    enabled: sessionStatus === "authenticated",
    queryFn: async () => {
      const response = await fetch("/api/marketplace/verification");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "verification_status_failed");
      return result as VerificationData;
    },
  });
  const items = useQuery({
    queryKey: ["marketplace-items"],
    queryFn: async () => {
      const response = await fetch("/api/marketplace/items");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "marketplace_items_failed");
      return result.items as MarketItem[];
    },
  });
  const ownItems = useQuery({
    queryKey: ["marketplace-own-items"],
    enabled: Boolean(verification.data?.isVerified),
    queryFn: async () => {
      const response = await fetch("/api/marketplace/items?mine=1");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "marketplace_own_items_failed");
      return result.items as MarketItem[];
    },
  });

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "sell") setTab("sell");
  }, []);

  const canSell = verification.data?.isVerified ?? false;
  const currentVerification = verification.data?.verification;
  const emailLinkExpired = currentVerification?.status === "pending_email"
    && new Date(currentVerification.emailTokenExpiresAt) <= new Date();

  async function resendVerificationEmail() {
    setResendingVerification(true);
    setResendFeedback(null);
    try {
      const response = await fetch("/api/marketplace/verification/resend", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "verification_resend_failed");
      setResendFeedback({
        message: isFrench ? "Un nouveau lien de confirmation a été envoyé." : "A new confirmation link has been sent.",
        isError: false,
      });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-verification"] });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setResendFeedback({
        message: getNetworkErrorMessage(error)
          ?? (code === "VERIFICATION_RESEND_RATE_LIMITED"
            ? (isFrench ? "Attendez une minute avant de demander un autre e-mail." : "Wait one minute before requesting another email.")
            : (isFrench ? "L’e-mail n’a pas pu être envoyé. Réessayez." : "The email could not be sent. Try again.")),
        isError: true,
      });
    } finally {
      setResendingVerification(false);
    }
  }

  const typeLabel = (type: MarketItem["type"]) => type === "MICRO_SAAS"
    ? "Micro-SaaS"
    : type === "TEMPLATE"
      ? "Template"
      : (isFrench ? "Service" : "Service");

  return (
    <main className="mx-auto max-w-6xl pb-12">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="inline-flex items-center gap-3 font-display text-3xl font-semibold text-ink">
            <Store size={24} className="text-gold-soft" aria-hidden="true" />
            Marketplace
          </h1>
        </div>
        <div className="flex gap-2" role="tablist" aria-label={isFrench ? "Sections du marketplace" : "Marketplace sections"}>
          <button type="button" role="tab" aria-selected={tab === "browse"} onClick={() => setTab("browse")} className={tab === "browse" ? "btn-gold !rounded-xl" : "btn-outline !rounded-xl"}>
            <ShoppingBag size={15} aria-hidden="true" />{isFrench ? "Offres" : "Listings"}
          </button>
          <button type="button" role="tab" aria-selected={tab === "sell"} onClick={() => setTab("sell")} className={tab === "sell" ? "btn-gold !rounded-xl" : "btn-outline !rounded-xl"}>
            <PackagePlus size={15} aria-hidden="true" />{isFrench ? "Déposer une offre" : "Create a listing"}
          </button>
        </div>
      </header>

      {tab === "browse" ? (
        <section role="tabpanel" aria-label={isFrench ? "Offres disponibles" : "Available listings"}>
          {items.isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => <div key={index} className="skeleton h-80 rounded-2xl" />)}
            </div>
          ) : items.isError ? (
            <div className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-5 text-sm text-rose-300">
              {isFrench ? "Les offres n’ont pas pu être chargées." : "Listings could not be loaded."}
            </div>
          ) : items.data?.length ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {items.data.map((item) => (
                <article key={item.id} className="overflow-hidden rounded-2xl border border-midnight-border bg-midnight-card/40">
                  <Link href={`/marketplace/${encodeURIComponent(item.id)}`} className="block">
                    <div className="aspect-[16/10] overflow-hidden bg-midnight-deep">
                      {item.imageUrl
                        ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover transition duration-200 hover:scale-[1.02]" />
                        : <div className="grid h-full place-items-center text-gold/70"><ShoppingBag size={30} aria-hidden="true" /></div>}
                    </div>
                  </Link>
                  <div className="space-y-3 p-4">
                    <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
                      <span className="badge-gold">{typeLabel(item.type)}</span>
                      <span>{isFrench ? "Prix de l’offre" : "Listing price"}</span>
                    </div>
                    <Link href={`/marketplace/${encodeURIComponent(item.id)}`} className="block font-semibold text-ink hover:text-gold-soft">
                      {item.title}
                    </Link>
                    <p className="line-clamp-2 min-h-10 text-sm leading-5 text-ink-muted">{item.description}</p>
                    <div className="flex items-center gap-2 text-xs text-ink-muted">
                      {item.seller.image && <img src={item.seller.image} alt="" className="h-6 w-6 rounded-full object-cover" />}
                      <span className="truncate">{item.seller.handle ? `@${item.seller.handle}` : item.seller.name ?? (isFrench ? "Vendeur" : "Seller")}</span>
                      <span className="ml-auto shrink-0 font-semibold text-gold-soft">{formatUsd(item.priceCents / 100, isFrench ? "fr-FR" : "en-US")}</span>
                    </div>
                    <MarketplaceContactSeller
                      listingId={item.id}
                      listingTitle={item.title}
                      sellerId={item.seller.id}
                      sellerName={item.seller.handle ? `@${item.seller.handle}` : item.seller.name}
                      sellerImage={item.seller.image}
                      isFrench={isFrench}
                      compact
                    />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-midnight-border bg-midnight-card/30 px-5 py-12 text-center">
              <ShoppingBag size={28} className="mx-auto text-gold-soft" aria-hidden="true" />
              <h2 className="mt-3 text-lg font-semibold text-ink">{isFrench ? "Aucune offre publiée" : "No listings available"}</h2>
              <button type="button" onClick={() => setTab("sell")} className="btn-gold mt-5 !rounded-xl">
                {isFrench ? "Déposer une offre" : "Create a listing"} <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
          )}
        </section>
      ) : (
        <section role="tabpanel" aria-label={isFrench ? "Espace vendeur" : "Seller workspace"}>
          {sessionStatus === "loading" || (sessionStatus === "authenticated" && verification.isLoading) ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-muted">
              <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />{isFrench ? "Chargement de votre espace vendeur…" : "Loading your seller workspace…"}
            </div>
          ) : sessionStatus !== "authenticated" ? (
            <div className="rounded-2xl border border-midnight-border bg-midnight-card/30 p-6 text-center">
              <p className="text-sm text-ink-muted">{isFrench ? "Connectez-vous pour vérifier votre compte vendeur et publier une offre." : "Sign in to verify your seller account and publish a listing."}</p>
              <Link href="/login?callbackUrl=%2Fmarketplace%3Ftab%3Dsell" className="btn-gold mt-4 !rounded-xl">{isFrench ? "Se connecter" : "Sign in"}</Link>
            </div>
          ) : verification.isError ? (
            <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-300">
              {isFrench ? "Le statut de votre vérification n’a pas pu être chargé." : "Your verification status could not be loaded."}
            </p>
          ) : canSell ? (
            <div className="space-y-8">
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-200">
                {isFrench ? "Votre compte vendeur est vérifié. Vous pouvez publier une offre." : "Your seller account is verified. You can publish a listing."}
              </div>
              <MarketplaceSellWizard
                initialLanguage={isFrench ? "fr" : "en"}
                onPublished={() => {
                  void queryClient.invalidateQueries({ queryKey: ["marketplace-own-items"] });
                  void queryClient.invalidateQueries({ queryKey: ["marketplace-items"] });
                }}
              />
              <section aria-labelledby="own-marketplace-listings">
                <h2 id="own-marketplace-listings" className="mb-4 text-lg font-semibold text-ink">{isFrench ? "Mes offres" : "My listings"}</h2>
                {ownItems.isLoading ? (
                  <div className="skeleton h-24 rounded-xl" />
                ) : ownItems.isError ? (
                  <p role="alert" className="text-sm text-rose-300">
                    {isFrench ? "Vos offres n’ont pas pu être chargées." : "Your listings could not be loaded."}
                  </p>
                ) : ownItems.data?.length ? (
                  <div className="space-y-3">
                    {ownItems.data.map((item) => (
                      <Link key={item.id} href={`/marketplace/${encodeURIComponent(item.id)}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-midnight-border bg-midnight-card/40 p-4 hover:border-gold/30">
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink">{item.title}</span>
                          <span className="mt-1 block text-xs text-ink-muted">
                            {item.moderationStatus === "APPROVED"
                              ? (isFrench ? "Publiée" : "Published")
                              : item.moderationStatus === "REJECTED"
                                ? (isFrench ? "Refusée" : "Rejected")
                                : (isFrench ? "En attente de validation" : "Awaiting review")}
                          </span>
                        </span>
                        <span className="font-semibold text-gold-soft">{formatUsd(item.priceCents / 100, isFrench ? "fr-FR" : "en-US")}</span>
                      </Link>
                    ))}
                  </div>
                ) : <p className="text-sm text-ink-muted">{isFrench ? "Vous n’avez pas encore publié d’offre." : "You have not published a listing yet."}</p>}
              </section>
            </div>
          ) : currentVerification?.status === "pending_email" && !emailLinkExpired ? (
            <div className="mx-auto max-w-2xl rounded-2xl border border-midnight-border bg-midnight-card/40 p-6 text-center">
              <Mail size={26} className="mx-auto text-gold-soft" aria-hidden="true" />
              <h2 className="mt-3 text-lg font-semibold text-ink">{isFrench ? "Confirmez votre adresse e-mail" : "Confirm your email address"}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                {isFrench ? `Un lien de vérification a été envoyé à ${currentVerification.email}. La vérification est gratuite et nécessaire pour vendre.` : `A verification link was sent to ${currentVerification.email}. Verification is free and required to sell.`}
              </p>
              <button type="button" onClick={() => void resendVerificationEmail()} disabled={resendingVerification} className="btn-outline mt-4 !rounded-xl disabled:opacity-50">
                {resendingVerification ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Mail size={15} aria-hidden="true" />}
                {isFrench ? "Renvoyer le lien" : "Resend link"}
              </button>
              {resendFeedback && <p role={resendFeedback.isError ? "alert" : "status"} className={`mt-3 text-sm ${resendFeedback.isError ? "text-rose-300" : "text-emerald-300"}`}>{resendFeedback.message}</p>}
            </div>
          ) : (
            <div className="mx-auto max-w-2xl">
              {!showVerificationForm ? (
                <div className="rounded-2xl border border-midnight-border bg-midnight-card/40 p-6 text-center">
                  <h2 className="text-lg font-semibold text-ink">{isFrench ? "Vérification vendeur gratuite" : "Free seller verification"}</h2>
                  <p className="mt-2 text-sm leading-6 text-ink-muted">
                    {isFrench ? "La vérification du compte est gratuite et obligatoire pour publier une offre. Elle protège les membres en confirmant les informations de votre profil vendeur et votre adresse e-mail." : "Account verification is free and required to publish a listing. It helps protect members by confirming your seller profile details and email address."}
                  </p>
                  {!verification.data?.accountEmailVerified && (
                    <p className="mt-3 text-sm text-amber-200">
                      {isFrench ? "Confirmez d’abord l’adresse e-mail de votre compte LynoraLink." : "First confirm your LynoraLink account email."}
                    </p>
                  )}
                  <button type="button" onClick={() => setShowVerificationForm(true)} disabled={!verification.data?.accountEmailVerified} className="btn-gold mt-5 !rounded-xl disabled:cursor-not-allowed disabled:opacity-50">
                    {isFrench ? "Vérifier mon compte vendeur" : "Verify my seller account"}
                  </button>
                </div>
              ) : (
                <MarketplaceVerificationWizard
                  isFrench={isFrench}
                  email={verification.data?.accountEmail ?? ""}
                  onCancel={() => setShowVerificationForm(false)}
                  onSubmitted={() => {
                    setShowVerificationForm(false);
                    void queryClient.invalidateQueries({ queryKey: ["marketplace-verification"] });
                  }}
                />
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
