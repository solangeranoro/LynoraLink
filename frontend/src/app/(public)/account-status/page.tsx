"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock3, ShieldAlert } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

type AccountStatusDetails = {
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  suspendedUntil: string | null;
  reason: string | null;
};

export default function AccountStatusPage() {
  const { data: session, status } = useSession();
  const { locale, t } = useTranslation();
  const [accountDetails, setAccountDetails] = useState<AccountStatusDetails | null>(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    let active = true;
    fetch("/api/account/status")
      .then(async (response) => {
        if (!response.ok) throw new Error("ACCOUNT_STATUS_UNAVAILABLE");
        return await response.json() as AccountStatusDetails;
      })
      .then((details) => {
        if (active) setAccountDetails(details);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const accountStatus = accountDetails?.status ?? session?.user?.accountStatus;
  const isBanned = accountStatus === "BANNED";
  const isActive = accountStatus === "ACTIVE";
  const suspendedUntil = accountDetails?.suspendedUntil ?? session?.user?.suspendedUntil;
  const reason = accountDetails?.reason ?? session?.user?.accountStatusReason;

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <section className="card w-full max-w-xl p-7 sm:p-9" aria-live="polite">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-rose-400/10">
          <ShieldAlert className="h-7 w-7 text-rose-300" aria-hidden="true" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">LynoraLink</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink">
          {status === "loading" || checking
            ? t("accountStatus.loading")
            : isBanned
              ? t("accountStatus.bannedTitle")
              : isActive
                ? t("accountStatus.activeTitle")
                : t("accountStatus.suspendedTitle")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          {status === "loading" || checking
            ? t("accountStatus.loadingDescription")
            : isBanned
              ? t("accountStatus.bannedDescription")
              : isActive
                ? t("accountStatus.activeDescription")
                : t("accountStatus.suspendedDescription")}
        </p>

        {accountStatus === "SUSPENDED" && suspendedUntil && (
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-midnight-border bg-midnight-surface px-4 py-3 text-sm text-ink">
            <Clock3 className="h-4 w-4 text-gold" aria-hidden="true" />
            <span>{t("accountStatus.until", { date: new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", { dateStyle: "long", timeStyle: "short" }).format(new Date(suspendedUntil)) })}</span>
          </div>
        )}

        {reason && (
          <div className="mt-4 rounded-xl border border-midnight-border px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("accountStatus.reason")}</h2>
            <p className="mt-1 text-sm leading-6 text-ink">{reason}</p>
          </div>
        )}

        <p className="mt-5 text-sm leading-6 text-ink-muted">{t("accountStatus.reviewHelp")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {isActive && <Link className="btn-gold" href="/dashboard">{t("accountStatus.returnToApp")}</Link>}
          {!isActive && <Link className="btn-gold" href="/contact">{t("accountStatus.contact")}</Link>}
          <button className="btn-outline" type="button" onClick={() => void signOut({ callbackUrl: "/login" })}>
            {t("accountStatus.signOut")}
          </button>
        </div>
      </section>
    </main>
  );
}
