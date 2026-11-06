import { AppShell } from "@/components/AppShell";
import { CopilotNavigationLoader } from "@/components/CopilotNavigationLoader";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="application-theme">
      <CopilotNavigationLoader>
        <AppShell>{children}</AppShell>
      </CopilotNavigationLoader>
    </div>
  );
}
