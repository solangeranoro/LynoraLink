import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Sora } from "next/font/google";
import "@xterm/xterm/css/xterm.css";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetBrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "LynoraLink — Global Co-Building Hub",
    template: "%s · LynoraLink",
  },
  description:
    "LynoraLink is the global co-building hub where indie makers and solopreneurs team up in real time to build and launch micro-projects.",
  applicationName: "LynoraLink",
  keywords: ["indie makers", "solopreneurs", "co-building", "build in public", "SaaS", "micro-projects"],
  authors: [{ name: "LynoraLink" }],
  openGraph: {
    title: "LynoraLink — Global Co-Building Hub",
    description: "Team up with makers worldwide and ship your micro-projects.",
    type: "website",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/logo_lynora.svg", type: "image/svg+xml", sizes: "any" }],
    shortcut: ["/logo_lynora.svg"],
    apple: [{ url: "/favicon.png", sizes: "512x512" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LynoraLink",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B132B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetBrainsMono.variable} ${sora.variable} dark`}>
      <body className="min-h-screen font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
