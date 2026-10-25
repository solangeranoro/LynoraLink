import type { Metadata } from "next";
import { IdeShell } from "@/components/ide/IdeShell";
import "./coding.css";

export const metadata: Metadata = {
  title: "LynoraCoding",
  description: "Edit and persist your private LynoraCoding workspace in LynoraLink.",
  icons: {
    icon: [{ url: "/logo_lynoracoding.svg", type: "image/svg+xml" }],
    shortcut: ["/logo_lynoracoding.svg"],
  },
};

export default function CodingPage() {
  return <IdeShell />;
}
