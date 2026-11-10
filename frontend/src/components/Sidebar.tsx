"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBookOpen,
  faChartColumn,
  faChevronUp,
  faComments,
  faCompass,
  faFolderOpen,
  faGear,
  faHandshake,
  faRobot,
  faScaleBalanced,
  faStore,
  faTableCellsLarge,
  faTrophy,
  faFlask,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { Avatar } from "@/components/Avatar";
import { NavigationCountBadge, type NavigationCountKey, useNavigationCounts } from "@/components/NavigationCounts";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useCopilotNavigationLoader } from "@/components/CopilotNavigationLoader";

type SidebarNavItem = { href: string; label: string; icon?: typeof faRobot; countKey?: NavigationCountKey };

export function Sidebar({ className }: { className?: string }) {
  const { t, locale } = useTranslation();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [profileExpanded, setProfileExpanded] = useState(false);
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
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!profileExpanded) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !profileMenuRef.current?.contains(event.target)) {
        setProfileExpanded(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileExpanded(false);
        profileButtonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileExpanded]);
  useEffect(() => {
    setProfileExpanded(false);
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
      </div>

      <div
        ref={profileMenuRef}
        className="relative shrink-0 px-4 py-3"
        onMouseEnter={() => setProfileExpanded(true)}
        onMouseLeave={(event) => {
          if (!event.currentTarget.contains(document.activeElement) || document.activeElement === profileButtonRef.current) {
            setProfileExpanded(false);
          }
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setProfileExpanded(false);
        }}
      >
        {profileExpanded && (
          <div
            id="sidebar-profile-menu"
            className="absolute inset-x-4 bottom-[calc(100%-0.25rem)] z-50 overflow-hidden rounded-2xl border border-midnight-border/80 bg-midnight-card/95 p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl"
          >
            <Link
              href="/profile"
              onClick={() => setProfileExpanded(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-muted transition hover:bg-midnight-deep/60 hover:text-ink"
            >
              <Avatar src={session?.user?.image} name={profileName} size={32} />
              <span className="min-w-0 flex-1 truncate font-medium text-ink">{t("nav.profile")}</span>
            </Link>
            <Link
              href="/settings"
              onClick={() => setProfileExpanded(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-muted transition hover:bg-midnight-deep/60 hover:text-ink"
            >
              <FontAwesomeIcon icon={faGear} className="w-4 text-center" aria-hidden="true" />
              <span>{t("nav.settings")}</span>
            </Link>
            <Link
              href="/terms"
              onClick={() => setProfileExpanded(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-muted transition hover:bg-midnight-deep/60 hover:text-ink"
            >
              <FontAwesomeIcon icon={faScaleBalanced} className="h-4 w-4 shrink-0 text-center" aria-hidden="true" />
              <span>{locale === "fr" ? "Conditions d’utilisation" : "Terms of service"}</span>
            </Link>
            <Link
              href="/documentation"
              onClick={() => setProfileExpanded(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-muted transition hover:bg-midnight-deep/60 hover:text-ink"
            >
              <FontAwesomeIcon icon={faBookOpen} className="h-4 w-4 shrink-0 text-center" aria-hidden="true" />
              <span>{locale === "fr" ? "Documentation" : "Documentation"}</span>
            </Link>
          </div>
        )}
        <div className="flex min-w-0 items-center gap-2">
          <button
            ref={profileButtonRef}
            type="button"
            aria-expanded={profileExpanded}
            aria-controls="sidebar-profile-menu"
            onFocus={() => setProfileExpanded(true)}
            onClick={() => {
              if (window.matchMedia("(hover: none)").matches) {
                setProfileExpanded((expanded) => !expanded);
              } else {
                setProfileExpanded(true);
              }
            }}
            className={cn(
              "group flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-midnight-card/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40",
              profileExpanded && "bg-midnight-card/60",
            )}
          >
            <Avatar src={session?.user?.image} name={profileName} size={38} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink transition group-hover:text-gold-soft">{profileName}</span>
              <span className="mt-0.5 block truncate text-xs text-ink-muted">{session?.user?.handle ? `@${session.user.handle}` : t("nav.profile")}</span>
            </span>
            <FontAwesomeIcon icon={faChevronUp} className={cn("h-3 w-3 shrink-0 text-ink-muted transition-transform", profileExpanded && "rotate-180")} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
