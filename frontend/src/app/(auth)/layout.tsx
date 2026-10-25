import { AuthHeader } from "@/components/auth/AuthHeader";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <AuthHeader />
      <main className="flex flex-1 items-center justify-center px-4 pb-5 pt-24 sm:pb-7">
        <div className="w-full max-w-5xl">
          {children}
        </div>
      </main>

      <footer className="px-6 py-4 text-center text-xs text-ink-muted">
        © {new Date().getFullYear()} LynoraLink · Global Co-Building Hub
      </footer>
    </div>
  );
}
