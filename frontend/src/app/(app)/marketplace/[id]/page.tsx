"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, ArrowUpRight, Check, ExternalLink, LoaderCircle, Pencil, ShoppingBag, Trash2, X } from "@/components/FontAwesomeIcons";
import { useTranslation } from "@/lib/i18n";
import { MarketplaceContactSeller } from "@/components/MarketplaceContactSeller";
import { MarketplaceSellWizard } from "@/components/MarketplaceSellWizard";
import { formatUsd } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ListingType = "TEMPLATE" | "MICRO_SAAS" | "SERVICE";
type ListingDetail = {
  id: string;
  title: string;
  description: string;
  type: ListingType;
  priceCents: number;
  currency: string;
  isSold: boolean;
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
  sellerVerified?: boolean;
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
  const soldLabel = isFrench ? "Vendu" : "Sold";
  const router = useRouter();
  const queryClient = useQueryClient();
  const [adminPreview, setAdminPreview] = useState<boolean | null>(null);
  const [working, setWorking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [editing, setEditing] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewError, setReviewError] = useState("");
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setAdminPreview(query.get("admin") === "1");
  }, []);
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

  function startEditing() {
    if (!listingQuery.data || listingQuery.data.isSold) return;
    setEditing(true);
  }

  async function deleteListing() {
    if (!listingQuery.data || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch(`/api/marketplace/items/${encodeURIComponent(listingQuery.data.id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "DELETE_FAILED");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["marketplace-item", params.id] }),
        queryClient.invalidateQueries({ queryKey: ["marketplace-items"] }),
        queryClient.invalidateQueries({ queryKey: ["marketplace-own-items"] }),
      ]);
      setDeleteDialogOpen(false);
      router.push("/marketplace");
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setDeleteError(code === "LISTING_HAS_ORDERS"
        ? (isFrench ? "Cette annonce ne peut pas être supprimée car elle est liée à une commande." : "This listing cannot be deleted because it has an order.")
        : code === "FORBIDDEN"
          ? (isFrench ? "Vous ne pouvez pas supprimer cette annonce." : "You cannot delete this listing.")
          : (isFrench ? "La suppression a échoué. Réessayez." : "Deletion failed. Please try again."));
    } finally {
      setDeleting(false);
    }
  }

  if (adminPreview === null || listingQuery.isLoading) return <main className="mx-auto max-w-6xl space-y-6 pb-12"><div className="skeleton h-5 w-28" /><div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]"><div className="space-y-5"><div className="skeleton aspect-[16/9]" /><div className="skeleton h-12 w-2/3" /><div className="skeleton h-36" /></div><div className="skeleton h-72" /></div></main>;
  if (listingQuery.isError || !listingQuery.data) return <main className="mx-auto max-w-6xl py-16 text-center"><h1 className="section-title">{isFrench ? "Annonce introuvable" : "Listing not found"}</h1><p className="mt-2 text-sm text-ink-muted">{isFrench ? "Cette annonce n’est plus disponible ou vous n’avez pas les droits nécessaires." : "This listing is unavailable or you do not have permission to view it."}</p><Link href={adminPreview ? "/admin?section=marketplace" : "/marketplace"} className="btn-ghost mt-6 !rounded-lg"><ArrowLeft size={15} aria-hidden="true" />{adminPreview ? (isFrench ? "Retour à l’administration" : "Back to admin") : (isFrench ? "Retour au marketplace" : "Back to marketplace")}</Link></main>;

  const item = listingQuery.data;
  if (editing) {
    return (
      <main className="mx-auto max-w-4xl space-y-6 pb-12">
        <nav aria-label={isFrench ? "Fil d’Ariane" : "Breadcrumb"}>
          <button type="button" onClick={() => setEditing(false)} className="inline-flex items-center gap-2 text-sm text-ink-muted transition hover:text-gold-soft">
            <ArrowLeft size={15} aria-hidden="true" />{isFrench ? "Retour à l’annonce" : "Back to listing"}
          </button>
        </nav>
        <MarketplaceSellWizard
          initialLanguage={item.language ?? (isFrench ? "fr" : "en")}
          initialData={item}
          onCancel={() => setEditing(false)}
          onPublished={() => {
            setEditing(false);
            setFeedbackMessage(isFrench
              ? "Annonce modifiée et envoyée pour validation. Elle sera republiée après approbation."
              : "Listing updated and submitted for review. It will be republished after approval.");
            void queryClient.invalidateQueries({ queryKey: ["marketplace-item", params.id] });
            void queryClient.invalidateQueries({ queryKey: ["marketplace-items"] });
            void queryClient.invalidateQueries({ queryKey: ["marketplace-own-items"] });
          }}
        />
      </main>
    );
  }
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

        <aside className="lg:sticky lg:top-6"><div className="space-y-4 rounded-2xl border border-midnight-border bg-midnight-card/60 p-5"><p className="text-xs font-semibold uppercase text-ink-muted">{itemType}</p>{item.isSold
          ? <p className="font-display text-2xl font-semibold text-ink-muted">{soldLabel}</p>
          : <><p className="text-xs text-ink-muted">{isFrench ? "Prix de l’offre" : "Listing price"}</p><p className="-mt-3 font-display text-2xl font-semibold text-gold-soft">{formatUsd(item.priceCents / 100, isFrench ? "fr-FR" : "en-US")}</p></>}
          {item.isOwner && item.moderationStatus !== "APPROVED" && <p className="rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-xs text-amber-200">{isFrench ? "Cette annonce n’est pas publiée pour le moment." : "This listing is not currently published."}</p>}
          {adminPreview ? <>
            <div className="flex flex-wrap gap-2 text-xs"><span className={item.moderationStatus === "APPROVED" ? "badge-gold" : item.moderationStatus === "REJECTED" ? "badge border-rose-400/30 text-rose-300" : "badge border-amber-300/30 text-amber-200"}>{item.moderationStatus === "APPROVED" ? (isFrench ? "Approuvée" : "Approved") : item.moderationStatus === "REJECTED" ? (isFrench ? "Refusée" : "Rejected") : (isFrench ? "En attente" : "Pending")}</span><span className={`badge ${item.isActive ? "border-emerald-400/30 text-emerald-300" : "text-ink-muted"}`}>{item.isActive ? (isFrench ? "En ligne" : "Published") : (isFrench ? "Masquée" : "Hidden")}</span></div>
            <p className={`text-xs ${item.sellerVerified ? "text-emerald-300" : "text-amber-200"}`}>{item.sellerVerified ? (isFrench ? "Compte vendeur vérifié · vérification gratuite" : "Seller account verified · free verification") : (isFrench ? "Vérification gratuite du compte vendeur requise" : "Free seller account verification required")}</p>
            {item.seller.email && <p className="break-all text-xs text-ink-muted">{item.seller.email}</p>}
            {item.moderationStatus !== "APPROVED" && <button type="button" onClick={() => void reviewListing(true)} disabled={working} className="btn-gold w-full !rounded-xl disabled:opacity-50">{working ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}{isFrench ? "Approuver et publier" : "Approve and publish"}</button>}
            {item.moderationStatus !== "REJECTED" && <button type="button" onClick={() => void reviewListing(false)} disabled={working} className="btn-ghost w-full !rounded-xl text-rose-300 disabled:opacity-50">{working ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <X size={15} aria-hidden="true" />}{isFrench ? "Refuser l’annonce" : "Reject listing"}</button>}
            {reviewMessage && <p role="status" className="text-xs text-emerald-300">{reviewMessage}</p>}
            {reviewError && <p role="alert" className="text-xs text-rose-300">{reviewError}</p>}
          </> : item.isOwner && !item.isSold ? (
            <>
              <button type="button" onClick={startEditing} className="btn-outline w-full !rounded-xl"><Pencil size={15} aria-hidden="true" />{isFrench ? "Modifier les détails de l’annonce" : "Edit listing details"}</button>
              {feedbackMessage && <p role="status" className="text-xs text-emerald-300">{feedbackMessage}</p>}
            </>
          ) : item.isOwner && item.isSold ? (
            <p className="text-xs text-ink-muted">{isFrench ? "Une annonce vendue ne peut plus être modifiée." : "A sold listing can no longer be edited."}</p>
          ) : <>
            <MarketplaceContactSeller listingId={item.id} listingTitle={item.title} sellerId={item.seller.id} sellerName={item.seller.handle ? `@${item.seller.handle}` : item.seller.name} sellerImage={item.seller.image} isFrench={isFrench} />
          </>}
          {!adminPreview && item.isOwner && <>
            <button type="button" onClick={() => { setDeleteError(""); setDeleteDialogOpen(true); }} className="btn-ghost w-full !rounded-xl border border-rose-400/30 text-rose-300 hover:bg-rose-400/10">
              <Trash2 size={15} aria-hidden="true" />
              {isFrench ? "Supprimer l’annonce" : "Delete listing"}
            </button>
            {!deleteDialogOpen && deleteError && <p role="alert" className="text-xs text-rose-300">{deleteError}</p>}
          </>}
        </div></aside>
      </div>
      {!adminPreview && item.isOwner && (
        <Dialog open={deleteDialogOpen} onOpenChange={(open) => { if (!deleting) setDeleteDialogOpen(open); }}>
          <DialogContent className="border-midnight-border bg-midnight-card text-ink sm:max-w-md" showCloseButton={!deleting}>
            <DialogHeader className="text-left">
              <div className="mb-1 grid size-11 place-items-center rounded-xl border border-rose-400/25 bg-rose-400/10 text-rose-300">
                <AlertTriangle size={20} aria-hidden="true" />
              </div>
              <DialogTitle className="text-lg text-ink">{isFrench ? "Supprimer cette annonce ?" : "Delete this listing?"}</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-ink-muted">
                {isFrench
                  ? <>L’annonce <span className="font-medium text-ink">« {item.title} »</span> sera supprimée définitivement. Cette action est irréversible.</>
                  : <>The listing <span className="font-medium text-ink">“{item.title}”</span> will be permanently deleted. This action cannot be undone.</>}
              </DialogDescription>
            </DialogHeader>
            {deleteError && <p role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/5 px-3 py-2 text-sm text-rose-300">{deleteError}</p>}
            <DialogFooter className="gap-2 sm:gap-2">
              <button type="button" onClick={() => setDeleteDialogOpen(false)} disabled={deleting} className="btn-ghost !rounded-xl">
                {isFrench ? "Garder l’annonce" : "Keep listing"}
              </button>
              <button type="button" onClick={() => void deleteListing()} disabled={deleting} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-400/35 bg-rose-500/15 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50">
                {deleting ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />}
                {deleting ? (isFrench ? "Suppression…" : "Deleting…") : (isFrench ? "Supprimer définitivement" : "Delete permanently")}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </main>
  );
}