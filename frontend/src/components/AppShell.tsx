"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { WorkspaceOverview, WorkspaceQuickActions } from "@/components/WorkspaceOverview";
import { ActiveMakers } from "@/components/ActiveMakers";
import { ActionToastProvider } from "@/components/ActionToast";
import { cn } from "@/lib/utils";

/**
 * AppShell — layout principal de l'application authentifiée.
 * Sidebar gauche + barre d'actions supérieure + contenu.
 */
export function AppShell({
  children,
  rightRail = true,
  className,
}: {
  children: React.ReactNode;
  rightRail?: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const isCopilotArea = pathname === "/copilot" || pathname.startsWith("/copilot/");
  const isCodingArea = pathname === "/coding" || pathname.startsWith("/coding/");
  const isMessagesPage = pathname === "/messages";
  const isFullWidthMobilePage = isAdminArea || pathname === "/discover" || pathname === "/profile";

  if (isCopilotArea || isCodingArea) return <>{children}</>;

  return (
    <ActionToastProvider>
      <div className="min-h-screen lg:flex">
        {!isAdminArea && <Sidebar className="sticky top-0 hidden h-screen shrink-0 lg:flex" />}
        <div className="min-w-0 flex-1">
          <TopNav />
          <main className={cn("min-w-0", className)}>
            <div className={cn("mx-auto flex w-full gap-6 px-4 py-6 sm:px-6 xl:px-8", isFullWidthMobilePage && "px-0", isMessagesPage && "py-0 md:py-6")}>
              <div className="min-w-0 flex-1">{children}</div>
              {rightRail && pathname === "/dashboard" && (
                <div className="hidden w-72 shrink-0 min-[1440px]:block min-[1600px]:w-80">
                  <div className="sticky top-24 space-y-4">
                    <WorkspaceOverview />
                    <WorkspaceQuickActions />
                    <ActiveMakers />
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </ActionToastProvider>
  );
}

export default AppShell;
