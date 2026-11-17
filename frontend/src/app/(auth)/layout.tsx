export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="application-theme relative flex h-dvh min-h-0 flex-col overflow-hidden">
      <main className="flex min-h-0 flex-1 items-stretch justify-center overflow-y-auto overscroll-contain px-0 pb-0 [scrollbar-width:none] sm:px-5 sm:pb-8 lg:px-8">
        {children}
      </main>

      <footer className="shrink-0 px-6 py-3 text-center text-xs text-ink-muted">
        © {new Date().getFullYear()} LynoraLink · Global Co-Building Hub
      </footer>
    </div>
  );
}
