import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="skeleton h-96 w-full rounded-xl" />}>
      <LoginForm />
    </Suspense>
  );
}
