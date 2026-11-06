import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Configuration Capacitor — compilation APK Android de LynoraLink.
 *
 * L'interface relaie ses appels API au backend; l'APK doit donc charger
 * l'application Next.js hébergée plutôt qu'un export statique embarqué.
 */
const config: CapacitorConfig = {
  appId: "app.lynoralink.mobile",
  appName: "LynoraLink",
  webDir: "out",
  backgroundColor: "#0B132B",
  android: {
    allowMixedContent: false,
    backgroundColor: "#0B132B",
  },
  // Définir l'URL du frontend de production pour utiliser l'API via son proxy :
  // server: {
  //   url: "https://lynoralink.vercel.app",
  //   cleartext: false,
  //   androidScheme: "https",
  // },
};

export default config;
