import type { Metadata } from "next";
import { WelcomePage } from "@/components/auth/WelcomePage";

export const metadata: Metadata = { title: "Welcome" };

export default function WelcomeRoute() {
  return <WelcomePage />;
}