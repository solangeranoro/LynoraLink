"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartColumn,
  faComments,
  faCompass,
  faFolderOpen,
  faGear,
  faHandshake,
  faRobot,
  faStore,
  faTableCellsLarge,
  faTrophy,
  faFlask,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/Avatar";
import { NavigationCountBadge, type NavigationCountKey, useNavigationCounts } from "@/components/NavigationCounts";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useCopilotNavigationLoader } from "@/components/CopilotNavigationLoader";

type SidebarNavItem = { href: string; label: string; icon?: typeof faRobot; countKey?: NavigationCountKey };

export function Sidebar({ className }: { className?: string }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { data: session } = useSession();
  const profileName = session?.user?.name?.trim() &&
    session.user.name.trim().toLowerCase() !== session.user.email?.toLowerCase()
    ? session.user.name.trim()
    : session?.user?.handle
      ? `@${session.user.handle}`
      : t("nav.yourProfile");
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
      "flex h-full min-h-0 w-72 flex-col overflow-hidden border-r border-midnight-border bg-midnight-deep/70 backdrop-blur-md",
        className,
      )}
    >
      <Link
        href="/dashboard"
      className="flex h-16 shrink-0 items-center bg-midnight-deep/95 px-6"
      >
        <Logo size={40} withWordmark priority />
      </Link>

      <div className="sidebar-scrollbar-hidden flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-5 pt-4">
        <nav className="flex flex-col gap-1">
          {nav.map(renderNavItem)}
        </nav>
      </div>

      <div className="shrink-0 px-5 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/profile" className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-midnight-card/50">
            <Avatar src={session?.user?.image} name={profileName} size={38} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink transition group-hover:text-gold-soft">
                {profileName}
              </span>
              <span className="mt-0.5 block truncate text-xs text-ink-muted">
                {session?.user?.handle ? `@${session.user.handle}` : t("nav.profile")}
              </span>
            </span>
          </Link>
          <Link
            href="/settings"
            aria-label={t("nav.settings")}
            title={t("nav.settings")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-muted transition hover:bg-midnight-card/50 hover:text-gold-soft"
          >
            <FontAwesomeIcon icon={faGear} className="h-[15px] w-[15px]" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
