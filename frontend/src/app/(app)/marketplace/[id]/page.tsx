"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Check, ExternalLink, LoaderCircle, Pencil, Save, ShoppingBag, X } from "@/components/FontAwesomeIcons";
import { useTranslation } from "@/lib/i18n";
import { MarketplaceContactSeller } from "@/components/MarketplaceContactSeller";
import { formatUsd } from "@/lib/utils";
import { openPaddleCheckout } from "@/lib/paddle-checkout";

type ListingType = "TEMPLATE" | "MICRO_SAAS" | "SERVICE";
type ListingDetail = {
  id: string;
  title: string;
  description: string;
  type: ListingType;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  productUrl: string | null;
  pitch: string | null;
  language: string | null;
  sellerCity: string | null;
  includedItems: Record<string, unknown> | null;
  audience: Record<string, unknown> | null;
  financial: Record<string, unknown> | null;
  details: Record<string, unknown> | null;
  photos: string[];
  createdAt: string;
  moderationStatus?: "PENDING" | "APPROVED" | "REJECTED";
  isActive?: boolean;
  isOwner: boolean;
  seller: { id: string; name: string | null; image: string | null; handle: string | null; email?: string };
};

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) return value.map(String).join(", ");
  return String(value);
}

export default function MarketplaceListingPage() {
  const params = useParams<{ id: string }>();
  const { locale } = useTranslation();
  const isFrench = locale === "fr";
  const queryClient = useQueryClient();
  const [adminPreview, setAdminPreview] = useState<boolean | null>(null);
  const [working, setWorking] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const [purchaseMessageIsError, setPurchaseMessageIsError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editMessage, setEditMessage] = useState("");
  const [editForm, setEditForm] = useState({ title: "", description: "", pitch: "", productUrl: "", price: "" });
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewError, setReviewError] = useState("");
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setAdminPreview(query.get("admin") === "1");
    const checkout = query.get("checkout");
    if (checkout === "success") {
      setPurchaseMessage(isFrench ? "Paiement confirmé. Votre achat est disponible dans l’onglet Achats." : "Payment confirmed. Your purchase is available in Purchases.");
      setPurchaseMessageIsError(false);
    } else if (checkout === "failed") {
      setPurchaseMessage(isFrench ? "Le paiement n’a pas pu être confirmé. Réessayez ou contactez l’assistance." : "Payment could not be confirmed. Try again or contact support.");
      setPurchaseMessageIsError(true);
    } else if (checkout === "pending") {
      setPurchaseMessage(isFrench ? "Le paiement est en cours de confirmation. Votre achat sera disponible dès réception." : "Payment is being confirmed. Your purchase will be available once confirmed.");
      setPurchaseMessageIsError(false);
    } else if (checkout === "cancelled") {
      setPurchaseMessage(isFrench ? "Paiement annulé." : "Checkout cancelled.");
      setPurchaseMessageIsError(false);
    }
  }, [isFrench]);
  const listingQuery = useQuery({
    queryKey: ["marketplace-item", params.id, adminPreview],
    enabled: adminPreview !== null,
    queryFn: async () => {
      const response = adminPreview
        ? await fetch(`/api/admin/marketplace?id=${encodeURIComponent(params.id)}`)
        : await fetch(`/api/marketplace/items/${encodeURIComponent(params.id)}`);
      if (!response.ok) throw new Error(response.status === 404 ? "NOT_FOUND" : "listing_failed");
      return (await response.json()).item as ListingDetail;
    },
  });

  async function reviewListing(approved: boolean) {
    if (!listingQuery.data) return;
    setWorking(true);
    setReviewMessage("");
    setReviewError("");
    try {
      const response = await fetch("/api/admin/marketplace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: listingQuery.data.id, action: approved ? "APPROVE" : "REJECT" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "REVIEW_FAILED");
      setReviewMessage(result.notificationSent === false
        ? (isFrench ? "Décision enregistrée, mais l’e-mail de notification n’a pas été envoyé." : "Decision saved, but the notification email was not sent.")
        : (approved ? (isFrench ? "Annonce approuvée et publiée." : "Listing approved and published.") : (isFrench ? "Annonce refusée et masquée." : "Listing rejected and hidden.")));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["marketplace-item", params.id] }),
        queryClient.invalidateQueries({ queryKey: ["admin-content", "marketplace"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }),
      ]);
    } catch {
      setReviewError(isFrench ? "La décision n’a pas pu être enregistrée. Réessayez." : "The moderation decision could not be saved. Try again.");
    } finally {
      setWorking(false);
    }
  }

  async function buyListing() {
    if (!listingQuery.data) return;
    setWorking(true);
    setPurchaseMessage("");
    setPurchaseMessageIsError(false);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "marketplace", itemId: listingQuery.data.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "checkout_failed");
      await openPaddleCheckout(result.transactionId, result.customerEmail, result.successUrl);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setPurchaseMessage(code === "PADDLE_MARKETPLACE_NOT_APPROVED"
          ? (isFrench ? "Les ventes marketplace sont en attente de l’approbation de Paddle." : "Marketplace sales are awaiting Paddle approval.")
          : code === "PADDLE_TAX_CATEGORY_NOT_APPROVED"
            ? (isFrench
              ? "Paddle n’a pas encore approuvé la catégorie fiscale de cette offre pour votre compte marchand. Demandez à Paddle d’activer la catégorie correspondante, puis réessayez."
              : "Paddle has not approved this listing’s tax category for your merchant account yet. Ask Paddle to enable the corresponding category, then try again.")
          : code === "BILLING_NOT_CONFIGURED" || code === "PADDLE_CLIENT_NOT_CONFIGURED"
            ? (isFrench ? "Paddle n’est pas configuré pour les paiements." : "Paddle payments are not configured.")
          : (isFrench ? "Paiement indisponible. Réessayez." : "Checkout unavailable. Try again."));
      setPurchaseMessageIsError(true);
      setWorking(false);
    }
  }

  function startEditing() {
    if (!listingQuery.data) return;
    setEditForm({
      title: listingQuery.data.title,
      description: listingQuery.data.description,
      pitch: listingQuery.data.pitch ?? "",
      productUrl: listingQuery.data.productUrl ?? "",
      price: String(listingQuery.data.priceCents / 100),
    });
    setEditMessage("");
    setEditing(true);
  }

  async function saveListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!listingQuery.data) return;
    const priceCents = Math.round(Number(editForm.price) * 100);
    if (!Number.isSafeInteger(priceCents) || priceCents < 50 || priceCents > 99999999) {
      setEditMessage(isFrench ? "Le prix doit être compris entre 0,50 $ et 999 999,99 $." : "Price must be between $0.50 and $999,999.99.");
      return;
    }

    setSavingEdit(true);
    setEditMessage("");
    try {
      const response = await fetch(`/api/marketplace/items/${encodeURIComponent(listingQuery.data.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          pitch: editForm.pitch,
          productUrl: editForm.productUrl,
          priceCents,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        const issues = result.issues as Record<string, string[] | undefined> | undefined;
        const firstIssue = issues ? Object.values(issues).flat()[0] : null;
        throw new Error(firstIssue ?? result.error ?? "listing_update_failed");
      }
      setEditing(false);
      setPurchaseMessage(isFrench
        ? "Annonce modifiée et envoyée pour validation. Elle sera republiée après approbation."
        : "Listing updated and submitted for review. It will be republished after approval.");
      setPurchaseMessageIsError(false);
      await queryClient.invalidateQueries({ queryKey: ["marketplace-item", params.id] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-items"] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-own-items"] });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setEditMessage(message === "FORBIDDEN"
        ? (isFrench ? "Vous ne pouvez pas modifier cette annonce." : "You cannot edit this listing.")
        : (isFrench ? "La modification a échoué. Vérifiez les champs et réessayez." : "The update failed. Check the fields and try again."));
    } finally {
      setSavingEdit(false);
    }
  }

  if (adminPreview === null || listingQuery.isLoading) return <main className="mx-auto max-w-6xl space-y-6 pb-12"><div className="skeleton h-5 w-28" /><div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]"><div className="space-y-5"><div className="skeleton aspect-[16/9]" /><div className="skeleton h-12 w-2/3" /><div className="skeleton h-36" /></div><div className="skeleton h-72" /></div></main>;
  if (listingQuery.isError || !listingQuery.data) return <main className="mx-auto max-w-6xl py-16 text-center"><h1 className="section-title">{isFrench ? "Annonce introuvable" : "Listing not found"}</h1><p className="mt-2 text-sm text-ink-muted">{isFrench ? "Cette annonce n’est plus disponible ou vous n’avez pas les droits nécessaires." : "This listing is unavailable or you do not have permission to view it."}</p><Link href={adminPreview ? "/admin?section=marketplace" : "/marketplace"} className="btn-ghost mt-6 !rounded-lg"><ArrowLeft size={15} aria-hidden="true" />{adminPreview ? (isFrench ? "Retour à l’administration" : "Back to admin") : (isFrench ? "Retour au marketplace" : "Back to marketplace")}</Link></main>;

  const item = listingQuery.data;
  const included = item.includedItems ?? {};
  const audience = item.audience ?? {};
  const financial = item.financial ?? {};
  const details = item.details ?? {};
  const itemType = item.type === "MICRO_SAAS" ? "Micro-SaaS" : item.type === "TEMPLATE" ? "Template" : (isFrench ? "Service" : "Service");
  const photos = [...new Set([item.imageUrl, ...item.photos].filter((photo): photo is string => Boolean(photo)))];
  const detailLabels: Record<string, string> = {
    stack: isFrench ? "Stack technique" : "Technology stack",
    integrations: isFrench ? "API et intégrations" : "APIs and integrations",
    createdYear: isFrench ? "Année de création" : "Year created",
    category: isFrench ? "Secteur" : "Industry",
    screenshots: isFrench ? "Captures d’écran" : "Screenshots",
    documentationUrl: isFrench ? "Documentation" : "Documentation",
    templateType: isFrench ? "Type de template" : "Template type",
    technologies: isFrench ? "Technologies" : "Technologies",
    license: isFrench ? "Licence" : "License",
    includedCount: isFrench ? "Pages / composants" : "Pages / components",
    previews: isFrench ? "Aperçus" : "Previews",
    serviceType: isFrench ? "Type de service" : "Service type",
    experience: isFrench ? "Expérience" : "Experience",
    portfolioUrl: "Portfolio",
    modalities: isFrench ? "Modalités" : "Service terms",
    tools: isFrench ? "Outils" : "Tools",
    caseStudies: isFrench ? "Études de cas" : "Case studies",
    supportTerms: "SLA / support",
  };
  const includedLabels: Record<string, string> = {
    sourceCodeUrl: isFrench ? "Code source / fichiers" : "Source code / files",
    websiteUrl: isFrench ? "Site / démonstration" : "Website / demo",
    domain: isFrench ? "Nom de domaine" : "Domain name",
  };
  const socialLabels: Record<string, string> = {
    facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube",
    x: "X", linkedin: "LinkedIn", discord: "Discord", telegram: "Telegram", subreddit: "Subreddit",
  };
  const revenueLabels: Record<string, string> = {
    ADS: isFrench ? "Publicité" : "Advertising",
    AFFILIATE: isFrench ? "Affiliation" : "Affiliate",
    SALES: isFrench ? "Ventes" : "Sales",
    SUBSCRIPTION: isFrench ? "Abonnements" : "Subscriptions",
    SPONSORSHIP: isFrench ? "Sponsoring" : "Sponsorship",
  };
  const formatNumber = (value: unknown) => Number(value ?? 0).toLocaleString(locale);
  const formatFinancialUsd = (value: unknown) => formatUsd(Number(value ?? 0), isFrench ? "fr-FR" : "en-US");
  const gallery = photos.length > 1 ? photos.slice(1) : [];
  const socialAccounts = included.socialAccounts;
  const socialAccountEntries = socialAccounts && typeof socialAccounts === "object" && !Array.isArray(socialAccounts)
    ? Object.entries(socialAccounts).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0)
    : [];

  return (
    <main className="mx-auto max-w-6xl space-y-6 pb-12">
      <nav aria-label={isFrench ? "Fil d’Ariane" : "Breadcrumb"}><Link href={adminPreview ? "/admin?section=marketplace" : "/marketplace"} className="inline-flex items-center gap-2 text-sm text-ink-muted transition hover:text-gold-soft"><ArrowLeft size={15} aria-hidden="true" />{adminPreview ? (isFrench ? "Administration · Marketplace" : "Admin · Marketplace") : "Marketplace"}</Link></nav>
      {adminPreview && <div className="rounded-xl border border-gold/25 bg-gold/5 px-4 py-3 text-sm text-gold-soft">{isFrench ? "Prévisualisation administrateur — cette annonce peut ne pas être encore publiée." : "Admin preview — this listing may not be published yet."}</div>}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article className="min-w-0 space-y-7">
          <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-midnight-border bg-midnight-card/50">
            {photos[0] ? <img src={photos[0]} alt={item.title} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-gold/70"><ShoppingBag size={40} aria-hidden="true" /></div>}
            <span className="absolute bottom-4 left-4 border border-white/15 bg-midnight-deep/90 px-3 py-1.5 text-xs font-semibold uppercase text-gold-soft">{itemType}</span>
          </div>
          {gallery.length > 0 && <div className="grid grid-cols-3 gap-3">{gallery.slice(0, 6).map((photo) => <a key={photo} href={photo} target="_blank" rel="noreferrer" className="aspect-[16/10] overflow-hidden rounded-xl border border-midnight-border"><img src={photo} alt={item.title} className="h-full w-full object-cover transition hover:scale-[1.02]" /></a>)}</div>}
          <header className="space-y-3 rounded-2xl border border-midnight-border bg-midnight-card/40 p-5">
            <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted"><span className="badge-gold">{itemType}</span><span>{new Date(item.createdAt).toLocaleDateString(locale)}</span>{item.sellerCity && <span>{item.sellerCity}</span>}</div>
            <h1 className="section-title !text-2xl">{item.title}</h1>
            {item.pitch && <p className="text-base text-gold-soft">{item.pitch}</p>}
            <div className="flex items-center gap-2 text-sm text-ink-muted">{item.seller.image && <img src={item.seller.image} alt="" className="h-7 w-7 rounded-full object-cover" />}<span>{item.seller.handle ? `@${item.seller.handle}` : item.seller.name ?? (isFrench ? "Maker" : "Maker")}</span></div>
          </header>
          <section className="space-y-3 rounded-2xl border border-midnight-border bg-midnight-card/40 p-5" aria-labelledby="listing-description-title"><h2 id="listing-description-title" className="text-base font-semibold text-ink">{isFrench ? "À propos de l’offre" : "About this listing"}</h2><p className="whitespace-pre-wrap text-sm leading-7 text-ink-muted">{item.description}</p>{item.productUrl && <a href={item.productUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-gold-soft hover:text-gold">{isFrench ? "Voir le produit" : "View product"}<ArrowUpRight size={14} aria-hidden="true" /></a>}</section>

          <section className="space-y-4 rounded-2xl border border-midnight-border bg-midnight-card/40 p-5" aria-labelledby="listing-included-title"><h2 id="listing-included-title" className="text-base font-semibold text-ink">{isFrench ? "Contenu inclus" : "What's included"}</h2><dl className="grid gap-4 sm:grid-cols-2">{Object.entries(includedLabels).map(([key, label]) => { const value = displayValue(included[key]); return value ? <div key={key}><dt className="text-xs text-ink-muted">{label}</dt><dd className="mt-1 break-all text-sm text-ink">{isHttpUrl(value) ? <a href={value} target="_blank" rel="noreferrer" className="text-gold-soft hover:underline">{value}<ExternalLink size={12} className="ml-1 inline" aria-hidden="true" /></a> : value}</dd></div> : null; })}</dl>
            {Array.isArray(included.visualUrls) && included.visualUrls.length > 0 && <div><h3 className="label">{isFrench ? "Visuels" : "Visuals"}</h3><div className="flex flex-wrap gap-3">{included.visualUrls.map((photo) => typeof photo === "string" && <a key={photo} href={photo} target="_blank" rel="noreferrer" className="text-sm text-gold-soft hover:underline">{isFrench ? "Ouvrir le visuel" : "Open visual"}<ArrowUpRight size={12} className="ml-1 inline" aria-hidden="true" /></a>)}</div></div>}
            {socialAccountEntries.length > 0 && <div><h3 className="label">{isFrench ? "Comptes sociaux" : "Social accounts"}</h3><div className="flex flex-wrap gap-x-4 gap-y-2">{socialAccountEntries.map(([network, url]) => <a key={network} href={url} target="_blank" rel="noreferrer" className="text-sm text-gold-soft hover:underline">{socialLabels[network] ?? network}<ArrowUpRight size={12} className="ml-1 inline" aria-hidden="true" /></a>)}</div></div>}
          </section>

          <section className="grid gap-7 rounded-2xl border border-midnight-border bg-midnight-card/40 p-5 sm:grid-cols-2">
            <div className="space-y-3"><h2 className="text-base font-semibold text-ink">{isFrench ? "Audience et trafic" : "Audience and traffic"}</h2><dl className="space-y-3 text-sm"><div><dt className="text-xs text-ink-muted">{isFrench ? "Abonnés / utilisateurs" : "Followers / users"}</dt><dd className="mt-1 text-ink">{formatNumber(audience.followers)}</dd></div><div><dt className="text-xs text-ink-muted">{isFrench ? "Vues mensuelles" : "Monthly views"}</dt><dd className="mt-1 text-ink">{formatNumber(audience.monthlyViews)}</dd></div><div><dt className="text-xs text-ink-muted">{isFrench ? "Source du trafic" : "Traffic source"}</dt><dd className="mt-1 text-ink">{displayValue(audience.trafficSource) || "—"}</dd></div><div><dt className="text-xs text-ink-muted">{isFrench ? "Répartition géographique" : "Geographic distribution"}</dt><dd className="mt-1 text-ink">{displayValue(audience.geographicDistribution) || "—"}</dd></div>{typeof audience.gscProperty === "string" && audience.gscProperty && <div><dt className="text-xs text-ink-muted">Google Search Console</dt><dd className="mt-1 text-ink"><a href={audience.gscProperty} target="_blank" rel="noreferrer" className="text-gold-soft hover:underline">{audience.gscProperty}<ArrowUpRight size={12} className="ml-1 inline" aria-hidden="true" /></a><span className="mt-1 block text-xs text-ink-muted">{isFrench ? "Propriété déclarée, non vérifiée." : "Self-reported property, not verified."}</span></dd></div>}</dl></div>
            <div className="space-y-3"><h2 className="text-base font-semibold text-ink">{isFrench ? "Données financières" : "Financial details"}</h2><dl className="space-y-3 text-sm"><div><dt className="text-xs text-ink-muted">{isFrench ? "Revenus mensuels" : "Monthly revenue"}</dt><dd className="mt-1 text-ink">{formatFinancialUsd(financial.monthlyRevenueUsd ?? financial.monthlyRevenueEur)}</dd></div><div><dt className="text-xs text-ink-muted">{isFrench ? "Coûts annuels" : "Annual costs"}</dt><dd className="mt-1 text-ink">{formatFinancialUsd(financial.annualCostsUsd ?? financial.annualCostsEur)}</dd></div><div><dt className="text-xs text-ink-muted">{isFrench ? "Sources de revenus" : "Revenue sources"}</dt><dd className="mt-1 text-ink">{Array.isArray(financial.revenueSources) ? financial.revenueSources.map((source) => revenueLabels[String(source)] ?? String(source)).join(", ") : "—"}</dd></div><div><dt className="text-xs text-ink-muted">{isFrench ? "Modèle économique" : "Business model"}</dt><dd className="mt-1 text-ink">{financial.businessModel === "MRR" ? "MRR" : isFrench ? "Vente ponctuelle" : "One-time sale"}</dd></div></dl></div>
          </section>

          <section className="space-y-4 rounded-2xl border border-midnight-border bg-midnight-card/40 p-5" aria-labelledby="listing-specific-title"><h2 id="listing-specific-title" className="text-base font-semibold text-ink">{isFrench ? `Détails ${itemType}` : `${itemType} details`}</h2><dl className="grid gap-4 sm:grid-cols-2">{Object.entries(details).map(([key, value]) => { const values = Array.isArray(value) ? value : [value]; return <div key={key} className="min-w-0"><dt className="text-xs text-ink-muted">{detailLabels[key] ?? key}</dt><dd className="mt-1 flex flex-wrap gap-2 text-sm text-ink">{values.map((entry, index) => { const rendered = displayValue(entry); return rendered ? isHttpUrl(rendered) ? <a key={`${key}-${index}`} href={rendered} target="_blank" rel="noreferrer" className="max-w-full break-all text-gold-soft hover:underline">{isFrench ? "Ouvrir le lien" : "Open link"}<ArrowUpRight size={12} className="ml-1 inline" aria-hidden="true" /></a> : <span key={`${key}-${index}`}>{rendered}{index < values.length - 1 ? "," : ""}</span> : null; })}</dd></div>; })}</dl></section>
        </article>

        <aside className="lg:sticky lg:top-6"><div className="space-y-4 rounded-2xl border border-midnight-border bg-midnight-card/60 p-5"><p className="text-xs font-semibold uppercase text-ink-muted">{itemType}</p><p className="font-display text-2xl font-semibold text-gold-soft">{formatUsd(item.priceCents / 100, isFrench ? "fr-FR" : "en-US")}</p>
          {item.isOwner && item.moderationStatus !== "APPROVED" && <p className="rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-xs text-amber-200">{isFrench ? "Cette annonce n’est pas publiée pour le moment." : "This listing is not currently published."}</p>}
          {adminPreview ? <>
            <div className="flex flex-wrap gap-2 text-xs"><span className={item.moderationStatus === "APPROVED" ? "badge-gold" : item.moderationStatus === "REJECTED" ? "badge border-rose-400/30 text-rose-300" : "badge border-amber-300/30 text-amber-200"}>{item.moderationStatus === "APPROVED" ? (isFrench ? "Approuvée" : "Approved") : item.moderationStatus === "REJECTED" ? (isFrench ? "Refusée" : "Rejected") : (isFrench ? "En attente" : "Pending")}</span><span className={`badge ${item.isActive ? "border-emerald-400/30 text-emerald-300" : "text-ink-muted"}`}>{item.isActive ? (isFrench ? "En ligne" : "Published") : (isFrench ? "Masquée" : "Hidden")}</span></div>
            {item.seller.email && <p className="break-all text-xs text-ink-muted">{item.seller.email}</p>}
            {item.moderationStatus !== "APPROVED" && <button type="button" onClick={() => void reviewListing(true)} disabled={working} className="btn-gold w-full !rounded-xl disabled:opacity-50">{working ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}{isFrench ? "Approuver et publier" : "Approve and publish"}</button>}
            {item.moderationStatus !== "REJECTED" && <button type="button" onClick={() => void reviewListing(false)} disabled={working} className="btn-ghost w-full !rounded-xl text-rose-300 disabled:opacity-50">{working ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <X size={15} aria-hidden="true" />}{isFrench ? "Refuser l’annonce" : "Reject listing"}</button>}
            {reviewMessage && <p role="status" className="text-xs text-emerald-300">{reviewMessage}</p>}
            {reviewError && <p role="alert" className="text-xs text-rose-300">{reviewError}</p>}
          </> : item.isOwner ? editing ? (
            <form onSubmit={saveListing} className="space-y-3" aria-label={isFrench ? "Modifier l’annonce" : "Edit listing"}>
              <h2 className="text-sm font-semibold text-ink">{isFrench ? "Modifier l’annonce et le prix" : "Edit listing and price"}</h2>
              <label className="block"><span className="label">{isFrench ? "Titre" : "Title"}</span><input required minLength={3} maxLength={100} value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} className="input" /></label>
              <label className="block"><span className="label">{isFrench ? "Prix (USD)" : "Price (USD)"}</span><input required type="number" min="0.50" max="999999.99" step="0.01" value={editForm.price} onChange={(event) => setEditForm({ ...editForm, price: event.target.value })} className="input" /></label>
              <label className="block"><span className="label">{isFrench ? "Description" : "Description"}</span><textarea required minLength={500} maxLength={10000} rows={6} value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} className="input resize-y" /></label>
              <label className="block"><span className="label">{isFrench ? "Accroche" : "Pitch"}</span><textarea required minLength={10} maxLength={180} rows={2} value={editForm.pitch} onChange={(event) => setEditForm({ ...editForm, pitch: event.target.value })} className="input resize-y" /></label>
              <label className="block"><span className="label">{isFrench ? "Lien du produit" : "Product URL"}</span><input required type="url" value={editForm.productUrl} onChange={(event) => setEditForm({ ...editForm, productUrl: event.target.value })} className="input" /></label>
              {editMessage && <p role="alert" className="text-xs text-rose-300">{editMessage}</p>}
              <button type="submit" disabled={savingEdit} className="btn-gold w-full !rounded-xl disabled:opacity-50">{savingEdit ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}{isFrench ? "Enregistrer les modifications" : "Save changes"}</button>
              <button type="button" onClick={() => setEditing(false)} disabled={savingEdit} className="btn-ghost w-full !rounded-xl">{isFrench ? "Annuler" : "Cancel"}</button>
              <p className="text-xs leading-relaxed text-ink-muted">{isFrench ? "Toute modification renvoie l’annonce en validation et la masque temporairement." : "Any change sends the listing for review and temporarily hides it."}</p>
            </form>
          ) : (
            <>
              <button type="button" onClick={startEditing} className="btn-outline w-full !rounded-xl"><Pencil size={15} aria-hidden="true" />{isFrench ? "Modifier l’annonce / le prix" : "Edit listing / price"}</button>
              {purchaseMessage && <p role={purchaseMessageIsError ? "alert" : "status"} className={`text-xs ${purchaseMessageIsError ? "text-rose-300" : "text-emerald-300"}`}>{purchaseMessage}</p>}
            </>
          ) : <>
            <button type="button" onClick={buyListing} disabled={working} className="btn-gold w-full !rounded-xl">{working ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <ShoppingBag size={16} aria-hidden="true" />}{isFrench ? "Acheter cette offre" : "Buy this listing"}</button><MarketplaceContactSeller listingId={item.id} listingTitle={item.title} sellerId={item.seller.id} sellerName={item.seller.handle ? `@${item.seller.handle}` : item.seller.name} sellerImage={item.seller.image} isFrench={isFrench} />{purchaseMessage && <p role={purchaseMessageIsError ? "alert" : "status"} className={`text-xs ${purchaseMessageIsError ? "text-rose-300" : "text-emerald-300"}`}>{purchaseMessage}</p>}<p className="text-xs leading-relaxed text-ink-muted">{isFrench ? "Le lien de livraison est communiqué uniquement après confirmation du paiement." : "The delivery link is only shared after payment is confirmed."}</p>
          </>}
        </div></aside>
      </div>
    </main>
  );
}