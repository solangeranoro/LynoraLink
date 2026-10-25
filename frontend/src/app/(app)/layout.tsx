import { AppShell } from "@/components/AppShell";
import { CopilotNavigationLoader } from "@/components/CopilotNavigationLoader";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CopilotNavigationLoader>
      <AppShell>{children}</AppShell>
    </CopilotNavigationLoader>
  );
}
