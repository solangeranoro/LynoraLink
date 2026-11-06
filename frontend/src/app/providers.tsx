"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { I18nProvider } from "@/lib/i18n";
import { applyAppearancePreferences, readAppearancePreferences } from "@/lib/appearance";
import { NavigationProgress } from "@/components/NavigationProgress";
import { SplashScreen } from "@/components/SplashScreen";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );

    useEffect(() => {
      const applySavedAppearance = () => applyAppearancePreferences(readAppearancePreferences());
      const onStorage = (event: StorageEvent) => {
        if (event.key === "lynora.settings.appearance") applySavedAppearance();
      };
      const onSystemThemeChange = () => {
        if (readAppearancePreferences().theme === "system") applySavedAppearance();
      };
      const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");

      applySavedAppearance();
      window.addEventListener("storage", onStorage);
      colorScheme.addEventListener("change", onSystemThemeChange);
      return () => {
        window.removeEventListener("storage", onStorage);
        colorScheme.removeEventListener("change", onSystemThemeChange);
      };
    }, []);

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <SplashScreen />
          <NavigationProgress />
          {children}
        </I18nProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
