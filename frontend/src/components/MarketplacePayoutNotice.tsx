export function MarketplacePayoutNotice({ isFrench }: { isFrench: boolean }) {
  return (
    <aside className="mb-6 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3">
      <h2 className="text-sm font-semibold text-amber-200">
        {isFrench ? "Versements vendeurs" : "Seller payouts"}
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">
        {isFrench
          ? "Aucune commission de plateforme n’est prélevée sur les ventes. Les frais de traitement du paiement Paddle peuvent s’appliquer ; les reversements vendeurs sont traités manuellement."
          : "No platform commission is taken from sales. Paddle payment processing fees may apply; seller payouts are handled manually."}
      </p>
    </aside>
  );
}
