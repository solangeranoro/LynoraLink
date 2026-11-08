const NETWORK_ERROR_PATTERN =
  /failed to fetch|fetch failed|networkerror|network error|network request failed|network-request-failed|load failed|err_network|err_internet_disconnected|err_connection|econnreset|econnrefused|etimedout|network connection.*(?:lost|closed|reset)/i;

function getLocale(locale?: "fr" | "en") {
  if (locale) return locale;
  if (typeof window !== "undefined") {
    try {
      const storedLocale = window.localStorage.getItem("lynora.locale");
      if (storedLocale === "fr" || storedLocale === "en") return storedLocale;
    } catch {
      // Fall back to the document or browser locale when storage is unavailable.
    }
    if (document.documentElement.lang === "fr") return "fr";
  }
  if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("fr")) return "fr";
  return "en";
}

export function getNetworkErrorMessage(error: unknown, locale?: "fr" | "en") {
  if (!(error instanceof Error)) return null;
  if (!NETWORK_ERROR_PATTERN.test(error.message) && error.name !== "NetworkError") return null;

  return getLocale(locale) === "fr"
    ? "La connexion au service LynoraLink a échoué. Vérifiez votre accès à Internet et réessayez. Si le problème persiste, contactez l’assistance."
    : "LynoraLink could not connect to the service. Check your internet connection and try again. If the problem persists, contact support.";
}

export function getUserFacingErrorMessage(error: unknown, fallback: string) {
  const networkMessage = getNetworkErrorMessage(error);
  if (networkMessage) return networkMessage;
  return error instanceof Error ? error.message : fallback;
}
