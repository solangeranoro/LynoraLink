"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, PackagePlus } from "@/components/FontAwesomeIcons";
import { formatUsd } from "@/lib/utils";

type ListingType = "TEMPLATE" | "MICRO_SAAS" | "SERVICE";
type SocialNetwork = "facebook" | "instagram" | "tiktok" | "youtube" | "x" | "linkedin" | "discord" | "telegram" | "subreddit";
type SaleForm = {
  type: ListingType; title: string; description: string; productUrl: string; pitch: string; language: string; sellerCity: string; price: string; deliveryUrl: string;
  sourceCodeUrl: string; websiteIncludedUrl: string; domain: string; visualUrls: string; socialAccounts: Record<SocialNetwork, string>;
  followers: string; monthlyViews: string; trafficSource: string; geographicDistribution: string; gscProperty: string;
  monthlyRevenueUsd: string; annualCostsUsd: string; revenueSources: string[]; businessModel: "MRR" | "ONE_SHOT";
  stack: string; integrations: string; createdYear: string; category: string; screenshots: string; microDocsUrl: string;
  templateType: string; technologies: string; license: "PERSONAL" | "COMMERCIAL" | "BOTH"; includedCount: string; previews: string; templateDocsUrl: string;
  serviceType: string; experience: string; portfolioUrl: string; modalities: string; tools: string; caseStudies: string; supportTerms: string;
  complianceAccepted: boolean;
};

const socialNetworks: { id: SocialNetwork; label: string }[] = [
  { id: "facebook", label: "Facebook" }, { id: "instagram", label: "Instagram" }, { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" }, { id: "x", label: "X" }, { id: "linkedin", label: "LinkedIn" },
  { id: "discord", label: "Discord" }, { id: "telegram", label: "Telegram" }, { id: "subreddit", label: "Subreddit" },
];
const revenueOptions = [
  { id: "ADS", fr: "Publicité", en: "Advertising" }, { id: "AFFILIATE", fr: "Affiliation", en: "Affiliate" },
  { id: "SALES", fr: "Ventes", en: "Sales" }, { id: "SUBSCRIPTION", fr: "Abonnements", en: "Subscriptions" },
  { id: "SPONSORSHIP", fr: "Sponsoring", en: "Sponsorship" },
];
const steps = ["Général", "Contenu", "Audience", "Finances", "Détails", "Validation"];
function createEmptyForm(language = "fr"): SaleForm {
  return {
    type: "TEMPLATE", title: "", description: "", productUrl: "", pitch: "", language, sellerCity: "", price: "", deliveryUrl: "",
    sourceCodeUrl: "", websiteIncludedUrl: "", domain: "", visualUrls: "",
    socialAccounts: { facebook: "", instagram: "", tiktok: "", youtube: "", x: "", linkedin: "", discord: "", telegram: "", subreddit: "" },
    followers: "0", monthlyViews: "0", trafficSource: "", geographicDistribution: "", gscProperty: "",
    monthlyRevenueUsd: "0", annualCostsUsd: "0", revenueSources: [], businessModel: "ONE_SHOT",
    stack: "", integrations: "", createdYear: String(new Date().getFullYear()), category: "", screenshots: "", microDocsUrl: "",
    templateType: "", technologies: "", license: "PERSONAL", includedCount: "", previews: "", templateDocsUrl: "",
    serviceType: "", experience: "", portfolioUrl: "", modalities: "", tools: "", caseStudies: "", supportTerms: "", complianceAccepted: false,
  };
}

function splitList(value: string) {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function isValidUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function MarketplaceSellWizard({ onPublished, initialLanguage = "fr" }: { onPublished: () => void; initialLanguage?: string }) {
  const [form, setForm] = useState<SaleForm>(() => createEmptyForm(initialLanguage));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const isFrench = form.language === "fr";
  const text = (fr: string, en: string) => isFrench ? fr : en;

  useEffect(() => {
    if (step !== 5 || !previewLoading) return;
    const timeout = window.setTimeout(() => setPreviewLoading(false), 400);
    return () => window.clearTimeout(timeout);
  }, [previewLoading, step]);

  function update<K extends keyof SaleForm>(key: K, value: SaleForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  function chooseListingType(type: ListingType) {
    setForm((current) => ({
      ...current,
      type,
      businessModel: type === "MICRO_SAAS" ? "MRR" : "ONE_SHOT",
      ...(type === "MICRO_SAAS" ? {} : { domain: "" }),
    }));
    setErrors({});
    setStatus("");
  }

  function validateStep(index: number) {
    const nextErrors: Record<string, string> = {};
    const required = (key: string, valid: boolean, message: string) => { if (!valid) nextErrors[key] = message; };
    const url = (key: string, value: string) => required(key, isValidUrl(value), text("Saisissez une URL http(s) valide.", "Enter a valid http(s) URL."));
    const numeric = (key: string, value: string, min = 0) => required(key, value !== "" && Number.isFinite(Number(value)) && Number(value) >= min, text("Saisissez un nombre valide.", "Enter a valid number."));

    if (index === 0) {
      required("title", form.title.trim().length >= 3 && form.title.length <= 100, text("3 caractères minimum.", "At least 3 characters."));
      required("description", form.description.trim().length >= 500, text("La description doit contenir au moins 500 caractères.", "Description must be at least 500 characters."));
      required("productUrl", isValidUrl(form.productUrl) && Boolean(form.productUrl), text("Une URL valide est requise.", "A valid URL is required."));
      required("pitch", form.pitch.trim().length >= 10, text("10 caractères minimum.", "At least 10 characters."));
      const priceCents = Number(form.price) * 100;
      required("price", Number.isSafeInteger(Math.round(priceCents)) && priceCents >= 50 && priceCents <= 99999999 && Math.abs(priceCents - Math.round(priceCents)) < 1e-7, text("Saisissez un prix compris entre 0,50 $ et 999 999,99 $, avec deux décimales maximum.", "Enter a price from $0.50 to $999,999.99 with at most two decimal places."));
      required("deliveryUrl", isValidUrl(form.deliveryUrl) && Boolean(form.deliveryUrl), text("Un lien de livraison http(s) est requis.", "A delivery http(s) URL is required."));
    }
    if (index === 1) {
      const hasIncludedContent = [form.sourceCodeUrl, form.websiteIncludedUrl, form.domain, form.visualUrls, ...Object.values(form.socialAccounts)].some((value) => value.trim());
      required("includedContent", hasIncludedContent, text("Indiquez au moins un élément inclus dans la vente.", "Add at least one item included in the sale."));
      const links = [form.sourceCodeUrl, form.websiteIncludedUrl, form.visualUrls, ...Object.values(form.socialAccounts)].flatMap(splitList);
      required("includedLinks", links.every(isValidUrl), text("Vérifiez les liens http(s).", "Check the http(s) links."));
    }
    if (index === 2) {
      numeric("followers", form.followers); numeric("monthlyViews", form.monthlyViews);
      required("trafficSource", form.trafficSource.trim().length >= 2, text("Indiquez la source principale.", "Add the primary source."));
      url("gscProperty", form.gscProperty);
    }
    if (index === 3) {
      numeric("monthlyRevenueUsd", form.monthlyRevenueUsd); numeric("annualCostsUsd", form.annualCostsUsd);
      required("revenueSources", form.revenueSources.length > 0, text("Choisissez au moins une source.", "Choose at least one source."));
    }
    if (index === 4 && form.type === "MICRO_SAAS") {
      required("stack", splitList(form.stack).length > 0, text("Ajoutez au moins une technologie.", "Add at least one technology."));
      numeric("createdYear", form.createdYear, 1990);
      required("category", form.category.trim().length > 1, text("Choisissez un secteur.", "Choose a category."));
      required("screenshots", splitList(form.screenshots).length > 0 && splitList(form.screenshots).every(isValidUrl), text("Ajoutez une capture avec une URL valide.", "Add a screenshot with a valid URL."));
      required("microDocsUrl", Boolean(form.microDocsUrl) && isValidUrl(form.microDocsUrl), text("Une URL de documentation valide est requise.", "A valid documentation URL is required."));
    }
    if (index === 4 && form.type === "TEMPLATE") {
      required("templateType", form.templateType.length > 1, text("Choisissez un type de template.", "Choose a template type."));
      required("technologies", splitList(form.technologies).length > 0, text("Ajoutez les technologies utilisées.", "Add the technologies used."));
      numeric("includedCount", form.includedCount, 1);
      required("previews", splitList(form.previews).length > 0 && splitList(form.previews).every(isValidUrl), text("Ajoutez un aperçu avec une URL valide.", "Add a preview with a valid URL."));
      required("templateDocsUrl", Boolean(form.templateDocsUrl) && isValidUrl(form.templateDocsUrl), text("Une URL de documentation valide est requise.", "A valid documentation URL is required."));
    }
    if (index === 4 && form.type === "SERVICE") {
      required("serviceType", form.serviceType.length > 1, text("Choisissez un type de service.", "Choose a service type."));
      required("experience", form.experience.trim().length >= 10, text("Décrivez votre expérience (10 caractères min.).", "Describe your experience (at least 10 characters)."));
      url("portfolioUrl", form.portfolioUrl);
      required("modalities", form.modalities.trim().length > 1, text("Indiquez vos modalités.", "Add your service modalities."));
      required("tools", splitList(form.tools).length > 0, text("Ajoutez les outils utilisés.", "Add the tools you use."));
      required("caseStudies", form.caseStudies.trim().length >= 20, text("Ajoutez une étude de cas ou un témoignage.", "Add a case study or testimonial."));
      required("supportTerms", form.supportTerms.trim().length >= 10, text("Précisez le support proposé.", "Describe your support terms."));
    }
    if (index === 5) required("complianceAccepted", form.complianceAccepted, text("Votre confirmation est requise.", "Your confirmation is required."));

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function nextStep() {
    if (!validateStep(step)) return;
    setStatus("");
    if (step === 4) setPreviewLoading(true);
    setStep((current) => Math.min(current + 1, 5));
  }

  async function submitSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateStep(5)) return;
    setSaving(true); setStatus("");
    const details = form.type === "MICRO_SAAS"
      ? { stack: splitList(form.stack), integrations: splitList(form.integrations), createdYear: Number(form.createdYear), category: form.category, screenshots: splitList(form.screenshots), documentationUrl: form.microDocsUrl }
      : form.type === "TEMPLATE"
        ? { templateType: form.templateType, technologies: splitList(form.technologies), license: form.license, includedCount: Number(form.includedCount), previews: splitList(form.previews), documentationUrl: form.templateDocsUrl }
        : { serviceType: form.serviceType, experience: form.experience, portfolioUrl: form.portfolioUrl, modalities: form.modalities, tools: splitList(form.tools), caseStudies: form.caseStudies, supportTerms: form.supportTerms };
    const photos = [...splitList(form.visualUrls), ...(form.type === "MICRO_SAAS" ? splitList(form.screenshots) : form.type === "TEMPLATE" ? splitList(form.previews) : [])].slice(0, 20);
    try {
      const response = await fetch("/api/marketplace/items", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(), description: form.description.trim(), type: form.type, productUrl: form.productUrl,
          pitch: form.pitch.trim(), language: form.language, sellerCity: form.sellerCity.trim(), priceCents: Math.round(Number(form.price) * 100),
          currency: "usd", deliveryUrl: form.deliveryUrl,
          includedItems: { sourceCodeUrl: form.sourceCodeUrl, websiteUrl: form.websiteIncludedUrl, domain: form.domain, visualUrls: splitList(form.visualUrls), socialAccounts: form.socialAccounts },
          audience: { followers: Number(form.followers), monthlyViews: Number(form.monthlyViews), trafficSource: form.trafficSource.trim(), geographicDistribution: form.geographicDistribution.trim(), gscProperty: form.gscProperty },
          financial: { monthlyRevenueUsd: Number(form.monthlyRevenueUsd), annualCostsUsd: Number(form.annualCostsUsd), revenueSources: form.revenueSources, businessModel: form.businessModel },
          details, photos, complianceAccepted: form.complianceAccepted,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "sale_failed");
      setStatus(text("Votre annonce est soumise à validation par l’administration. Elle sera visible après approbation.", "Your listing is awaiting platform admin review and will be visible after approval."));
      setForm(createEmptyForm(initialLanguage)); setStep(0); onPublished();
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setStatus(code === "UNAUTHORIZED"
        ? text("Connectez-vous pour publier une annonce.", "Sign in to publish a listing.")
        : code === "VERIFICATION_REQUIRED"
          ? text("Confirmez votre profil vendeur avant de publier.", "Verify your seller profile before publishing.")
          : text("Envoi impossible. Vérifiez les champs et réessayez.", "Submission failed. Check the fields and try again."));
    } finally { setSaving(false); }
  }

  const input = (key: keyof SaleForm, label: string, options: { type?: string; placeholder?: string; min?: string; max?: string; step?: string } = {}) => (
    <label className="block" key={key}><span className="label">{label}</span><input type={options.type ?? "text"} value={String(form[key])} onChange={(event) => update(key, event.target.value as SaleForm[typeof key])} placeholder={options.placeholder} min={options.min} max={options.max} step={options.step} className="input" />{errors[key] && <span className="mt-1 block text-xs text-rose-300">{errors[key]}</span>}</label>
  );
  const textarea = (key: keyof SaleForm, label: string, placeholder = "", rows = 3) => (
    <label className="block" key={key}><span className="label">{label}</span><textarea value={String(form[key])} onChange={(event) => update(key, event.target.value as SaleForm[typeof key])} placeholder={placeholder} rows={rows} className="input resize-y" />{errors[key] && <span className="mt-1 block text-xs text-rose-300">{errors[key]}</span>}</label>
  );
  const select = (key: keyof SaleForm, label: string, options: { value: string; label: string }[]) => (
    <label className="block" key={key}><span className="label">{label}</span><select value={String(form[key])} onChange={(event) => update(key, event.target.value as SaleForm[typeof key])} className="input">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{errors[key] && <span className="mt-1 block text-xs text-rose-300">{errors[key]}</span>}</label>
  );
  const typeLabels: Record<ListingType, string> = { TEMPLATE: "Template", MICRO_SAAS: "Micro-SaaS", SERVICE: text("Service", "Service") };
  const typeSpecificFields: Record<ListingType, string[]> = {
    MICRO_SAAS: [text("Stack technique", "Technology stack"), text("API et intégrations", "APIs and integrations"), text("Année et secteur", "Year and industry"), text("Captures et documentation", "Screenshots and documentation")],
    TEMPLATE: [text("Type et technologies", "Type and technologies"), text("Licence", "License"), text("Pages / composants", "Pages / components"), text("Galerie et documentation", "Gallery and documentation")],
    SERVICE: [text("Type de service et expérience", "Service type and experience"), text("Portfolio", "Portfolio"), text("Modalités et outils", "Terms and tools"), text("Études de cas et support SLA", "Case studies and support SLA")],
  };
  const copy = {
    MICRO_SAAS: {
      title: text("Nom du Micro-SaaS", "Micro-SaaS name"),
      description: text("Décrivez le problème résolu, les fonctionnalités, les utilisateurs et les modalités de reprise.", "Describe the problem solved, features, users, and handover terms."),
      productUrl: text("URL de l’application", "Application URL"), pitch: text("Promesse / proposition de valeur", "Promise / value proposition"),
      includedIntro: text("Indiquez les éléments transférés avec le produit logiciel.", "List the assets transferred with the software product."),
      sourceCode: text("Dépôt du code source", "Source code repository"), website: text("Site en production", "Live product website"),
      domain: text("Nom de domaine transféré", "Domain name being transferred"), visuals: text("Logo et captures d’écran (URLs)", "Logo and app screenshots (URLs)"),
      followers: text("Utilisateurs actifs / abonnés", "Active users / subscribers"), views: text("Visites mensuelles de l’application", "Monthly application visits"), traffic: text("Canal d’acquisition principal", "Primary acquisition channel"),
      revenue: text("MRR / revenus mensuels (USD)", "MRR / monthly revenue (USD)"), costs: text("Coûts annuels d’infrastructure et d’exploitation (USD)", "Annual infrastructure and operating costs (USD)"),
      recurringModel: text("MRR / revenus récurrents", "MRR / recurring revenue"), oneShotModel: text("Ventes ponctuelles", "One-time sales"),
    },
    TEMPLATE: {
      title: text("Nom du template ou du pack", "Template or pack name"),
      description: text("Décrivez les écrans, pages, composants, fichiers livrés et logiciels requis.", "Describe the screens, pages, components, deliverables, and required software."),
      productUrl: text("URL de démonstration / aperçu", "Demo / preview URL"), pitch: text("Bénéfice ou style du template", "Template benefit or style"),
      includedIntro: text("Précisez les fichiers source, la démo et les éléments visuels livrés avec le template.", "Describe the source files, demo, and visuals included with the template."),
      sourceCode: text("Fichier source / archive à transférer", "Source file / archive to transfer"), website: text("Démo interactive du template", "Interactive template demo"),
      domain: "", visuals: text("Galerie d’aperçus (URLs)", "Preview gallery (URLs)"),
      followers: text("Abonnés de la communauté", "Community followers"), views: text("Visites mensuelles des pages de vente", "Monthly sales-page visits"), traffic: text("Canal principal des visiteurs", "Primary visitor channel"),
      revenue: text("Ventes mensuelles du template (USD)", "Monthly template sales (USD)"), costs: text("Coûts annuels de production et d’outils (USD)", "Annual production and tool costs (USD)"),
      recurringModel: text("Licences / revenus récurrents", "Licenses / recurring revenue"), oneShotModel: text("Ventes ponctuelles", "One-time sales"),
    },
    SERVICE: {
      title: text("Nom de l’offre de service", "Service offer name"),
      description: text("Décrivez le périmètre, les livrables, le déroulement et les résultats attendus.", "Describe the scope, deliverables, process, and expected outcomes."),
      productUrl: text("Page de service / portfolio", "Service page / portfolio"), pitch: text("Spécialité / résultat client", "Specialty / client outcome"),
      includedIntro: text("Ajoutez des exemples de livrables, votre page de service et les éléments remis au client.", "Add sample deliverables, your service page, and materials provided to clients."),
      sourceCode: text("Exemples de livrables / documents", "Sample deliverables / documents"), website: text("Portfolio ou page de réservation", "Portfolio or booking page"),
      domain: "", visuals: text("Visuels et études de cas (URLs)", "Visuals and case studies (URLs)"),
      followers: text("Abonnés / clientèle", "Followers / client base"), views: text("Visites mensuelles du portfolio", "Monthly portfolio visits"), traffic: text("Canal principal d’acquisition client", "Primary client acquisition channel"),
      revenue: text("Revenus mensuels des prestations (USD)", "Monthly service revenue (USD)"), costs: text("Coûts annuels liés aux prestations (USD)", "Annual service delivery costs (USD)"),
      recurringModel: text("Forfaits / contrats récurrents", "Retainers / recurring contracts"), oneShotModel: text("Prestations ponctuelles", "One-time services"),
    },
  }[form.type];
  const headings = [text("Informations générales", "General information"), text("Contenu inclus", "Included content"), text("Audience et trafic", "Audience and traffic"), text("Données financières", "Financial details"), `${text("Détails", "Details")} ${typeLabels[form.type]}`, text("Récapitulatif et conformité", "Review and compliance")];
  const typeReview = form.type === "MICRO_SAAS"
    ? [
        { label: text("Stack technique", "Technology stack"), value: splitList(form.stack).join(", ") },
        { label: text("Intégrations", "Integrations"), value: splitList(form.integrations).join(", ") },
        { label: text("Secteur / année", "Industry / year"), value: [form.category, form.createdYear].filter(Boolean).join(" · ") },
        { label: text("Captures d’écran", "Screenshots"), value: splitList(form.screenshots).join(", ") },
        { label: text("Documentation", "Documentation"), value: form.microDocsUrl },
      ]
    : form.type === "TEMPLATE"
      ? [
          { label: text("Type de template", "Template type"), value: form.templateType },
          { label: text("Technologies", "Technologies"), value: splitList(form.technologies).join(", ") },
          { label: text("Licence / éléments", "License / items"), value: `${form.license} · ${form.includedCount}` },
          { label: text("Aperçus", "Previews"), value: splitList(form.previews).join(", ") },
          { label: text("Documentation", "Documentation"), value: form.templateDocsUrl },
        ]
      : [
          { label: text("Type de service", "Service type"), value: form.serviceType },
          { label: text("Expérience", "Experience"), value: form.experience },
          { label: text("Modalités / outils", "Terms / tools"), value: [form.modalities, splitList(form.tools).join(", ")].filter(Boolean).join(" · ") },
          { label: text("Portfolio", "Portfolio"), value: form.portfolioUrl },
          { label: text("Études de cas", "Case studies"), value: form.caseStudies },
          { label: "SLA", value: form.supportTerms },
        ];

  return (
    <section className="min-w-0 space-y-5" aria-labelledby="sale-wizard-title">
      <div>
        <div className="mb-3 flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-soft">{text("Nouvelle annonce", "New listing")}</p><span className="text-xs text-ink-muted">{text(`Étape ${step + 1} sur ${steps.length}`, `Step ${step + 1} of ${steps.length}`)}</span></div>
        <ol className="grid grid-cols-3 gap-1.5 sm:grid-cols-6" aria-label={text("Progression du formulaire", "Form progress")}>
          {steps.map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined} className="min-w-0"><div className={`mb-2 h-1 rounded-full ${index <= step ? "bg-gold" : "bg-midnight-border"}`} /><div className="flex items-center gap-1.5 text-[10px] leading-tight sm:text-xs"><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${index < step ? "border-gold bg-gold text-midnight-deep" : index === step ? "border-gold text-gold-soft" : "border-midnight-border text-ink-muted"}`}>{index < step ? <Check size={12} aria-hidden="true" /> : index + 1}</span><span className={index === step ? "text-gold-soft" : "text-ink-muted"}>{index === 4 ? typeLabels[form.type] : text(label, ["General", "Included", "Audience", "Finances", "Details", "Review"][index])}</span></div></li>)}
        </ol>
      </div>

      <form onSubmit={submitSale} className="rounded-xl border border-midnight-border bg-midnight-card/40 p-4 sm:p-6">
        <div key={step} className="animate-slide-left space-y-5">
          <div><h2 id="sale-wizard-title" className="text-lg font-semibold text-ink">{headings[step]}</h2>{step === 0 && <p className="mt-1 text-xs text-ink-muted">{text("Le prix de vente est affiché et encaissé en USD.", "The sale price is displayed and charged in USD.")}</p>}</div>

          {step === 0 && <div className="space-y-4">
            <fieldset><legend className="label">{text("Type de vente", "Sale type")}</legend><div className="grid gap-2 sm:grid-cols-3">{(["MICRO_SAAS", "TEMPLATE", "SERVICE"] as ListingType[]).map((type) => <button type="button" key={type} aria-pressed={form.type === type} onClick={() => chooseListingType(type)} className={`rounded-xl border px-3 py-3 text-left text-sm transition ${form.type === type ? "border-gold bg-gold/10 text-gold-soft" : "border-midnight-border text-ink-muted hover:border-gold/50"}`}>{typeLabels[type]}</button>)}</div><div className="mt-3 rounded-xl border border-gold/20 bg-gold/5 p-3"><p className="text-xs font-medium text-gold-soft">{text(`Champs spécifiques : ${typeLabels[form.type]}`, `Type-specific fields: ${typeLabels[form.type]}`)}</p><ul className="mt-2 grid gap-1 text-xs text-ink-muted sm:grid-cols-2">{typeSpecificFields[form.type].map((field) => <li key={field}>• {field}</li>)}</ul></div></fieldset>
            {input("title", copy.title, { max: "100" })}
            <div>{textarea("description", text("Description détaillée", "Detailed description"), copy.description, 6)}<p className={`mt-1 text-right text-xs ${form.description.trim().length >= 500 ? "text-gold-soft" : "text-ink-muted"}`}>{form.description.trim().length}/500 {text("caractères minimum", "minimum characters")}</p></div>
            {input("productUrl", copy.productUrl, { type: "url", placeholder: "https://" })}
            {input("pitch", copy.pitch, { max: "180" })}
            <div className="grid gap-4 sm:grid-cols-2">
              {select("language", text("Langue principale", "Primary language"), [{ value: "fr", label: "Français" }, { value: "en", label: "English" }, { value: "es", label: "Español" }, { value: "de", label: "Deutsch" }, { value: "other", label: text("Autre", "Other") }])}
              {input("sellerCity", text("Ville du vendeur", "Seller city"), { max: "100" })}
              {input("price", text("Prix de vente (USD)", "Sale price (USD)"), { type: "number", min: "0.50", max: "999999.99", step: "0.01" })}
              {input("deliveryUrl", text("Lien de livraison après achat", "Delivery link after purchase"), { type: "url", placeholder: "https://" })}
            </div>
            <p className="rounded-lg border border-gold/20 bg-gold/5 p-3 text-xs leading-relaxed text-ink-muted">
              {text(
                "Aucune commission plateforme n’est prélevée sur vos ventes. Les frais de traitement Paddle peuvent s’appliquer.",
                "No platform commission is deducted from your sales. Paddle processing fees may apply.",
              )}
            </p>
          </div>}

          {step === 1 && <div className="space-y-4"><p className="text-sm text-ink-muted">{copy.includedIntro}</p><div className="grid gap-4 sm:grid-cols-2">
            {input("sourceCodeUrl", copy.sourceCode, { type: "url", placeholder: form.type === "MICRO_SAAS" ? "https://github.com/..." : "https://" })}{input("websiteIncludedUrl", copy.website, { type: "url", placeholder: "https://" })}{form.type === "MICRO_SAAS" && input("domain", copy.domain, { placeholder: "example.com" })}{textarea("visualUrls", copy.visuals, text("Une URL par ligne", "One URL per line"))}
          </div><fieldset><legend className="label">{text("Comptes sociaux inclus", "Included social accounts")}</legend><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{socialNetworks.map(({ id, label }) => <label key={id} className="block"><span className="mb-1 block text-xs text-ink-muted">{label}</span><input type="url" value={form.socialAccounts[id]} onChange={(event) => update("socialAccounts", { ...form.socialAccounts, [id]: event.target.value })} placeholder="https://" className="input !py-2" /></label>)}</div></fieldset>{errors.includedContent && <p role="alert" className="text-xs text-rose-300">{errors.includedContent}</p>}{errors.includedLinks && <p role="alert" className="text-xs text-rose-300">{errors.includedLinks}</p>}</div>}

          {step === 2 && <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2">{input("followers", copy.followers, { type: "number", min: "0" })}{input("monthlyViews", copy.views, { type: "number", min: "0" })}{input("trafficSource", copy.traffic, { placeholder: "SEO, réseaux sociaux…" })}{input("gscProperty", text("Propriété Google Search Console", "Google Search Console property"), { type: "url", placeholder: "https://example.com" })}</div>{textarea("geographicDistribution", text("Répartition géographique de l’audience", "Audience geographic distribution"), text("Ex. France 45 %, Canada 20 %…", "e.g. France 45%, Canada 20%…"))}<p className="rounded-lg border border-gold/20 bg-gold/5 p-3 text-xs leading-relaxed text-ink-muted">{text("La propriété Search Console est déclarative. Le badge « GSC Certified » ne sera affiché qu’après une vérification Google OAuth.", "The Search Console property is self-reported. A “GSC Certified” badge requires Google OAuth verification.")}</p></div>}

          {step === 3 && <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2">{input("monthlyRevenueUsd", copy.revenue, { type: "number", min: "0", step: "0.01" })}{input("annualCostsUsd", copy.costs, { type: "number", min: "0", step: "0.01" })}</div><fieldset><legend className="label">{text("Sources de revenus", "Revenue sources")}</legend><div className="grid gap-2 sm:grid-cols-2">{revenueOptions.map((option) => <label key={option.id} className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={form.revenueSources.includes(option.id)} onChange={(event) => update("revenueSources", event.target.checked ? [...form.revenueSources, option.id] : form.revenueSources.filter((value) => value !== option.id))} className="h-4 w-4 accent-[#12A98C]" />{text(option.fr, option.en)}</label>)}</div>{errors.revenueSources && <span className="mt-1 block text-xs text-rose-300">{errors.revenueSources}</span>}</fieldset><div><span className="label">{text("Modèle économique", "Business model")}</span><div className="grid grid-cols-2 gap-2">{[{ id: "MRR" as const, label: copy.recurringModel }, { id: "ONE_SHOT" as const, label: copy.oneShotModel }].map((option) => <button type="button" key={option.id} aria-pressed={form.businessModel === option.id} onClick={() => update("businessModel", option.id)} className={`rounded-xl border px-3 py-3 text-sm ${form.businessModel === option.id ? "border-gold bg-gold/10 text-gold-soft" : "border-midnight-border text-ink-muted hover:border-gold/50"}`}>{option.label}</button>)}</div></div></div>}

          {step === 4 && form.type === "MICRO_SAAS" && <div className="grid gap-4 sm:grid-cols-2">{textarea("stack", text("Stack technique", "Technology stack"), "React, Node.js, Prisma, PostgreSQL, Tailwind…")}{textarea("integrations", text("API et intégrations", "APIs and integrations"), "Stripe, Firebase, WebRTC…")}{input("createdYear", text("Année de création", "Year created"), { type: "number", min: "1990", max: String(new Date().getFullYear() + 1) })}{select("category", text("Catégorie / secteur", "Category / industry"), [{ value: "", label: text("Sélectionner…", "Select…") }, ...["Finance", "Éducation", "E-commerce", "Productivité", "Santé", "Marketing", "Autre"].map((value) => ({ value, label: value }))])}{textarea("screenshots", text("Captures de l’application (URLs)", "App screenshots (URLs)"), text("Une URL par ligne", "One URL per line"))}{input("microDocsUrl", text("Documentation technique", "Technical documentation"), { type: "url", placeholder: "https://..." })}</div>}

          {step === 4 && form.type === "TEMPLATE" && <div className="grid gap-4 sm:grid-cols-2">{select("templateType", text("Type de template", "Template type"), [{ value: "", label: text("Sélectionner…", "Select…") }, ...["UI/UX", "Site web", "Application mobile", "Dashboard"].map((value) => ({ value, label: value === "Site web" && !isFrench ? "Website" : value === "Application mobile" && !isFrench ? "Mobile app" : value }))])}{textarea("technologies", text("Technologies utilisées", "Technologies used"), "Figma, Webflow, Tailwind, React…")}{select("license", text("Licence", "License"), [{ value: "PERSONAL", label: text("Usage personnel", "Personal use") }, { value: "COMMERCIAL", label: text("Usage commercial", "Commercial use") }, { value: "BOTH", label: text("Personnel et commercial", "Personal and commercial") }])}{input("includedCount", text("Nombre de pages / composants", "Pages / components included"), { type: "number", min: "1" })}{textarea("previews", text("Galerie d’aperçus (URLs)", "Preview gallery (URLs)"), text("Une URL d’image par ligne", "One image URL per line"))}{input("templateDocsUrl", text("Documentation d’installation", "Installation documentation"), { type: "url", placeholder: "https://..." })}</div>}

          {step === 4 && form.type === "SERVICE" && <div className="grid gap-4 sm:grid-cols-2">{select("serviceType", text("Type de service", "Service type"), [{ value: "", label: text("Sélectionner…", "Select…") }, ...["Design", "Développement", "Marketing", "Consulting"].map((value) => ({ value, label: value === "Développement" && !isFrench ? "Development" : value }))])}{textarea("experience", text("Expérience", "Experience"), text("Années d’expérience, spécialités…", "Years of experience, specialties…"))}{input("portfolioUrl", text("Portfolio", "Portfolio"), { type: "url", placeholder: "https://" })}{input("modalities", text("Modalités de prestation", "Service modalities"), { placeholder: text("Ponctuel, abonnement, forfait…", "One-shot, subscription, package…") })}{textarea("tools", text("Outils utilisés", "Tools used"), "Canva, VS Code, GitHub…")}{textarea("caseStudies", text("Études de cas ou témoignages", "Case studies or testimonials"), "", 4)}{textarea("supportTerms", `SLA / ${text("conditions de support", "support terms")}`, text("Délais, disponibilité, durée du support…", "Response times, availability, support period…"))}</div>}

          {step === 5 && <div className="space-y-4">{previewLoading ? <div className="space-y-3" aria-label={text("Chargement de l’aperçu", "Loading preview")}><div className="skeleton h-8 w-2/3" /><div className="skeleton h-24 w-full" /><div className="skeleton h-16 w-full" /></div> : <div className="space-y-4 rounded-xl border border-midnight-border bg-midnight-deep/50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="badge-gold">{typeLabels[form.type]}</span><h3 className="mt-3 font-display text-lg font-semibold text-ink">{form.title || text("Titre de l’annonce", "Listing title")}</h3><p className="mt-1 text-sm text-gold-soft">{form.pitch}</p></div><span className="text-sm font-semibold text-gold-soft">{form.price ? formatUsd(Number(form.price), form.language === "fr" ? "fr-FR" : "en-US") : "—"}</span></div><p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">{form.description}</p><dl className="grid gap-3 border-t border-midnight-border pt-3 text-xs sm:grid-cols-2"><div><dt className="text-ink-muted">URL</dt><dd className="truncate text-ink">{form.productUrl || "—"}</dd></div><div><dt className="text-ink-muted">{text("Ville / langue", "City / language")}</dt><dd className="text-ink">{[form.sellerCity, form.language.toUpperCase()].filter(Boolean).join(" · ") || "—"}</dd></div><div><dt className="text-ink-muted">{text("Audience", "Audience")}</dt><dd className="text-ink">{Number(form.followers).toLocaleString()} {text("abonnés", "followers")} · {Number(form.monthlyViews).toLocaleString()} {text("vues/mois", "views/month")}</dd></div><div><dt className="text-ink-muted">{text("Revenus mensuels", "Monthly revenue")}</dt><dd className="text-ink">{formatUsd(Number(form.monthlyRevenueUsd), form.language === "fr" ? "fr-FR" : "en-US")}</dd></div></dl></div>}<label className="flex items-start gap-3 rounded-xl border border-midnight-border p-4 text-sm leading-relaxed text-ink"><input type="checkbox" checked={form.complianceAccepted} onChange={(event) => update("complianceAccepted", event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#12A98C]" /><span>{text("Je confirme être autorisé à vendre ces éléments et respecter le RGPD, les droits de propriété intellectuelle et les conditions d’utilisation de LynoraLink.", "I confirm I am authorized to sell these assets and will comply with GDPR, intellectual property rights, and LynoraLink's terms of use.")}</span></label>{errors.complianceAccepted && <p role="alert" className="text-xs text-rose-300">{errors.complianceAccepted}</p>}</div>}
        </div>
        {step === 5 && <section className="mt-4 rounded-xl border border-midnight-border bg-midnight-deep/50 p-4" aria-label={text("Détails de l’offre", "Offer details")}><h3 className="text-sm font-semibold text-gold-soft">{text("Détails de l’offre", "Offer details")} · {typeLabels[form.type]}</h3><dl className="mt-3 grid gap-3 sm:grid-cols-2">{typeReview.map((item) => <div key={item.label}><dt className="text-xs text-ink-muted">{item.label}</dt><dd className="break-words text-sm text-ink">{item.value || "—"}</dd></div>)}</dl></section>}
        {status && <p role="status" className="mt-4 text-sm text-gold-soft">{status}</p>}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-midnight-border pt-4"><button type="button" onClick={() => { setErrors({}); setStep((current) => Math.max(0, current - 1)); }} disabled={step === 0 || saving} className="btn-ghost !rounded-xl"><ArrowLeft size={15} aria-hidden="true" />{text("Précédent", "Back")}</button>{step < 5 ? <button type="button" onClick={nextStep} className="btn-gold !rounded-xl">{text("Continuer", "Continue")}<ArrowRight size={15} aria-hidden="true" /></button> : <button type="submit" disabled={saving || previewLoading} className="btn-gold !rounded-xl"><PackagePlus size={15} aria-hidden="true" />{saving ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : null}{text("Soumettre la vente", "Submit listing")}</button>}</div>
      </form>
    </section>
  );
}