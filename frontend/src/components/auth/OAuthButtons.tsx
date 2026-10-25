"use client";

import { useQuery } from "@tanstack/react-query";
import { getProviders, signIn } from "next-auth/react";
import { useTranslation } from "@/lib/i18n";

function GoogleIcon() {
  return (
    <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z" />
      <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5.1c-1.8 1.2-4 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z" />
      <path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8l6.8-5.3Z" />
      <path fill="#EA4335" d="M24 12c3 0 5.6 1 7.7 3l5.8-5.8A19.4 19.4 0 0 0 24 4 20 20 0 0 0 5.8 15.1l6.8 5.3C14.2 15.6 18.7 12 24 12Z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  );
}

export function OAuthButtons({ callbackUrl = "/dashboard" }: { callbackUrl?: string }) {
  const { t } = useTranslation();
  const providersQuery = useQuery({
    queryKey: ["auth", "providers"],
    queryFn: async () => {
      const providers = await getProviders();
      if (!providers) throw new Error("AUTH_PROVIDERS_UNAVAILABLE");
      return providers;
    },
    staleTime: 5 * 60_000,
  });
  const googleUnavailable = providersQuery.isSuccess && !providersQuery.data.google;
  const facebookUnavailable = providersQuery.isSuccess && !providersQuery.data.facebook;
  const googleDisabled = providersQuery.isLoading || providersQuery.isError || googleUnavailable;
  const facebookDisabled = providersQuery.isLoading || providersQuery.isError || facebookUnavailable;
  const googleUnavailableLabel = t("auth.errors.googleSignInUnavailable");
  const facebookUnavailableLabel = t("auth.errors.facebookSignInUnavailable");

  return (
    <>
      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-midnight-border" />
        <span className="text-xs uppercase text-ink-muted">{t("common.or")}</span>
        <span className="h-px flex-1 bg-midnight-border" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => void signIn("google", { callbackUrl })}
          disabled={googleDisabled}
          title={googleDisabled ? googleUnavailableLabel : undefined}
          className="btn-ghost w-full min-w-0 !gap-2 !px-2 text-xs leading-tight disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
        >
          <GoogleIcon />
          <span className="min-w-0 whitespace-nowrap">{t("auth.continueGoogle")}</span>
        </button>
        <button
          type="button"
          onClick={() => void signIn("facebook", { callbackUrl })}
          disabled={facebookDisabled}
          title={facebookDisabled ? facebookUnavailableLabel : undefined}
          className="btn-ghost w-full min-w-0 !gap-2 !px-2 text-xs leading-tight disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
        >
          <FacebookIcon />
          <span className="min-w-0 whitespace-nowrap">{t("auth.continueFacebook")}</span>
        </button>
      </div>
    </>
  );
}

export default OAuthButtons;
