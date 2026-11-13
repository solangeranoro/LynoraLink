"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBookOpen,
  faChartColumn,
  faCircleInfo,
  faCircleQuestion,
  faChevronUp,
  faComments,
  faCompass,
  faEnvelope,
  faFolderOpen,
  faHandshake,
  faRobot,
  faScaleBalanced,
  faStore,
  faTableCellsLarge,
  faTrophy,
  faFlask,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { NavigationCountBadge, type NavigationCountKey, useNavigationCounts } from "@/components/NavigationCounts";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useCopilotNavigationLoader } from "@/components/CopilotNavigationLoader";

type SidebarNavItem = { href: string; label: string; icon?: typeof faRobot; countKey?: NavigationCountKey };

export function Sidebar({ className }: { className?: string }) {
  const { t, locale } = useTranslation();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [helpExpanded, setHelpExpanded] = useState(false);
  const navigationCounts = useNavigationCounts(session?.user?.id);
  const { showCopilotSplash } = useCopilotNavigationLoader();
  const nav: SidebarNavItem[] = [
    { href: "/dashboard", label: t("nav.dashboard"), icon: faTableCellsLarge },
    { href: "/projects", label: t("nav.myProjects"), icon: faFolderOpen, countKey: "myProjects" },
    { href: "/teams", label: t("nav.myTeam"), icon: faUsers, countKey: "myTeams" },
    { href: "/discover", label: t("nav.discover"), icon: faCompass, countKey: "discoverProjects" },
    { href: "/makers", label: t("nav.makers"), icon: faHandshake, countKey: "makers" },
    { href: "/messages", label: t("nav.messages"), icon: faComments, countKey: "unreadMessages" },
    { href: "/copilot", label: t("nav.aiCopilot") },
    { href: "/analytics", label: t("nav.analytics"), icon: faChartColumn },
    { href: "/marketplace", label: t("nav.marketplace"), icon: faStore, countKey: "marketplaceItems" },
    { href: "/tester-applications", label: t("nav.testerApplications"), icon: faFlask },
    { href: "/top-makers", label: t("nav.topMakers"), icon: faTrophy, countKey: "topMakers" },
  ];
  useEffect(() => {
    if (["/about", "/help", "/faq", "/documentation", "/terms", "/contact"].some((href) => pathname === href || pathname.startsWith(`${href}/`))) {
      setHelpExpanded(true);
    }
  }, [pathname]);

  function renderNavItem({ href, label, icon, countKey }: SidebarNavItem) {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return <Link
      key={href}
      href={href}
      prefetch={href === "/copilot" ? false : undefined}
      onClick={(event) => {
        if (
          href === "/copilot" &&
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey
        ) {
          showCopilotSplash();
        }
      }}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
        active
          ? "bg-gold/10 text-gold-soft shadow-[inset_0_0_0_1px_rgba(8,111,88,0.3)]"
          : "text-ink-muted hover:bg-midnight-card/60 hover:text-ink",
      )}
    >
      {href === "/copilot" ? (
        <Image
          src="/logo_assistant_ia.svg"
          alt=""
          width={20}
          height={20}
          className="h-5 w-5 shrink-0 object-contain"
          aria-hidden="true"
        />
      ) : icon ? (
        <FontAwesomeIcon icon={icon} className={cn("h-[18px] w-[18px]", active ? "text-gold" : "text-ink-muted group-hover:text-gold-soft")} aria-hidden="true" />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {countKey && <NavigationCountBadge count={navigationCounts.badgeCounts?.[countKey]} />}
    </Link>;
  }

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-72 flex-col overflow-hidden bg-transparent",
        className,
      )}
    >
      <div className="sidebar-scrollbar-hidden flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-5 pt-4">
        <nav className="flex flex-col gap-1">
          {nav.map(renderNavItem)}
        </nav>
        <div className="space-y-1 border-t border-midnight-border pt-4">
          <button
            type="button"
            aria-expanded={helpExpanded}
            aria-controls="sidebar-help-menu"
            onClick={() => setHelpExpanded((expanded) => !expanded)}
            className={cn(
              "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition",
              helpExpanded
                ? "bg-gold/10 text-gold-soft"
                : "text-ink-muted hover:bg-midnight-card/60 hover:text-ink",
            )}
          >
            <FontAwesomeIcon icon={faCircleQuestion} className="h-[18px] w-[18px] text-ink-muted group-hover:text-gold-soft" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{locale === "fr" ? "À propos et aide" : "About & help"}</span>
            <FontAwesomeIcon icon={faChevronUp} className={cn("h-3 w-3 shrink-0 text-ink-muted transition-transform", helpExpanded && "rotate-180")} aria-hidden="true" />
          </button>
          {helpExpanded && (
            <div id="sidebar-help-menu" className="ml-3 space-y-1 border-l border-midnight-border pl-3">
              {[
                { href: "/about", label: locale === "fr" ? "À propos" : "About", icon: faCircleInfo },
                { href: "/help", label: locale === "fr" ? "Aide" : "Help", icon: faCircleQuestion },
                { href: "/faq", label: "FAQ", icon: faCircleQuestion },
                { href: "/documentation", label: locale === "fr" ? "Documentation" : "Documentation", icon: faBookOpen },
                { href: "/terms", label: locale === "fr" ? "Conditions d’utilisation" : "Terms of service", icon: faScaleBalanced },
                { href: "/contact", label: locale === "fr" ? "Contact" : "Contact", icon: faEnvelope },
              ].map(({ href, label, icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                      active
                        ? "bg-gold/10 text-gold-soft"
                        : "text-ink-muted hover:bg-midnight-card/60 hover:text-ink",
                    )}
                  >
                    <FontAwesomeIcon icon={icon} className={cn("h-4 w-4 shrink-0", active ? "text-gold" : "text-ink-muted group-hover:text-gold-soft")} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </aside>
  );
}

export default Sidebar;
