export type ThemePreference = "dark" | "light" | "system";
export type FontSizePreference = "small" | "normal" | "large";

export type AppearancePreferences = {
  theme: ThemePreference;
  fontSize: FontSizePreference;
};

export const appearanceStorageKey = "lynora.settings.appearance";

export const defaultAppearance: AppearancePreferences = {
  theme: "light",
  fontSize: "normal",
};

export function readAppearancePreferences(): AppearancePreferences {
  try {
    const value = localStorage.getItem(appearanceStorageKey);
    if (!value) return defaultAppearance;

    const parsed = JSON.parse(value) as Partial<AppearancePreferences>;
    return {
      theme: parsed.theme === "light" || parsed.theme === "system" || parsed.theme === "dark" ? parsed.theme : defaultAppearance.theme,
      fontSize: parsed.fontSize === "small" || parsed.fontSize === "large" ? parsed.fontSize : defaultAppearance.fontSize,
    };
  } catch {
    return defaultAppearance;
  }
}

export function applyAppearancePreferences(preferences: AppearancePreferences) {
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = preferences.theme === "system"
    ? systemPrefersDark ? "dark" : "light"
    : preferences.theme;

  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.fontSize = preferences.fontSize;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    theme === "dark" ? "#071120" : "#ffffff",
  );
}

export function saveAppearancePreferences(preferences: AppearancePreferences) {
  try {
    localStorage.setItem(appearanceStorageKey, JSON.stringify(preferences));
  } catch {
    // The current selection still applies for this page if storage is unavailable.
  }
  applyAppearancePreferences(preferences);
}