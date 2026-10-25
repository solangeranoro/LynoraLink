"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faBell,
  faCheckDouble,
  faChevronDown,
  faChartColumn,
  faComments,
  faCode,
  faCompass,
  faFolderOpen,
  faGear,
  faHandshake,
  faMagnifyingGlass,
  faPlus,
  faRightFromBracket,
  faShieldHalved,
  faStore,
  faTableCellsLarge,
  faTrophy,
  faUsers,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { Avatar } from "@/components/Avatar";
import { Logo } from "@/components/Logo";
import { useLogoutTransition } from "@/components/auth/LogoutTransition";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NavigationCountBadge, type NavigationCountKey, useNavigationCounts } from "@/components/NavigationCounts";
import { useTranslation } from "@/lib/i18n";
import { cn, timeAgo } from "@/lib/utils";

type SearchPerson = {
  id: string;
  name: string | null;
  image: string | null;
  handle: string | null;
  headline: string | null;
};
type SearchProject = {
  id: string;
  title: string;
  tagline: string;
  logoUrl: string | null;
  creator: { name: string | null; handle: string | null };
};
type SearchTeam = {
  id: string;
  title: string;
  teamName: string | null;
  tagline: string;
  logoUrl: string | null;
  creator: { name: string | null; handle: string | null };
};
type SearchResults = { people: SearchPerson[]; projects: SearchProject[]; teams: SearchTeam[] };
type SearchResult =
  | { type: "person"; item: SearchPerson }
  | { type: "project"; item: SearchProject }
  | { type: "team"; item: SearchTeam };
type UserNotification = {
  id: string;
  type: "WELCOME" | "POST_REACTION" | "POST_COMMENT" | "ASSOCIATION_REQUEST" | "ASSOCIATION_ACCEPTED" | "PROJECT_REQUEST" | "PROJECT_INVITE" | "PROJECT_ACCEPTED" | "PROJECT_DECLINED";
  targetId: string;
  readAt: string | null;
  createdAt: string;
  actor: { name: string | null; handle: string | null; image: string | null } | null;
};

export function TopNav() {
  const { t, locale } = useTranslation();
  const pathname = usePathname();
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const router = useRouter();
  const { data: session } = useSession();
  const profileName = session?.user?.name?.trim() &&
    session.user.name.trim().toLowerCase() !== session.user.email?.toLowerCase()
    ? session.user.name.trim()
    : session?.user?.handle
      ? `@${session.user.handle}`
      : t("common.maker");
  const { logout, overlay: logoutOverlay } = useLogoutTransition();
  const isAdmin = session?.user?.email?.toLowerCase() === "nambinintsoachrysologue0@gmail.com";
  const queryClient = useQueryClient();
  const notificationQuery = useQuery({
    queryKey: ["notifications", session?.user?.id],
    enabled: Boolean(session?.user?.id),
    queryFn: async () => {
      const response = await fetch("/api/notifications");
      if (!response.ok) throw new Error("notifications_load_failed");
      return response.json() as Promise<{ notifications: UserNotification[]; unreadCount: number }>;
    },
    refetchInterval: 3_000,
  });
  const markNotificationRead = useMutation({
    mutationFn: async (payload: { id?: string; all?: boolean }) => {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("notification_update_failed");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", session?.user?.id] }),
  });
  const isFrench = locale === "fr"; // Define the locale flag for French
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults>({ people: [], projects: [], teams: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const notifications = notificationQuery.data?.notifications ?? [];
  const unreadNotifications = notificationQuery.data?.unreadCount ?? 0;
  const navigationCounts = useNavigationCounts(session?.user?.id);

  useEffect(() => {
    const updateCurrentTime = () => setCurrentTime(Date.now());
    updateCurrentTime();
    const interval = window.setInterval(updateCurrentTime, 15_000);
    return () => window.clearInterval(interval);
  }, []);

  function notificationTime(createdAt: string) {
    if (currentTime === null) return new Date(createdAt).toLocaleDateString(locale);

    const date = new Date(createdAt);
    const now = new Date(currentTime);
    if (currentTime - date.getTime() < 60_000) return t("notifications.justNow");

    const startOfToday = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfNotificationDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const daysAgo = Math.round((startOfToday - startOfNotificationDay) / 86_400_000);
    if (daysAgo === 0) return t("notifications.today");
    if (daysAgo === 1) return t("notifications.yesterday");
    return timeAgo(date, locale);
  }

  function notificationText(notification: UserNotification) {
    const actor = notification.actor?.name ?? (notification.actor?.handle ? `@${notification.actor.handle}` : t("notifications.someone"));
    const keys: Record<UserNotification["type"], string> = {
      WELCOME: "notifications.welcome",
      POST_REACTION: "notifications.postReaction",
      POST_COMMENT: "notifications.postComment",
      ASSOCIATION_REQUEST: "notifications.associationRequest",
      ASSOCIATION_ACCEPTED: "notifications.associationAccepted",
      PROJECT_REQUEST: "notifications.projectRequest",
      PROJECT_INVITE: "notifications.projectInvite",
      PROJECT_ACCEPTED: "notifications.projectAccepted",
      PROJECT_DECLINED: "notifications.projectDeclined",
    };
    return t(keys[notification.type], { actor });
  }

  function notificationHref(notification: UserNotification) {
    if (notification.type === "WELCOME") return "/dashboard";
    if (notification.type === "POST_REACTION" || notification.type === "POST_COMMENT") return `/dashboard#post-${notification.targetId}`;
    if (notification.type === "ASSOCIATION_REQUEST") return "/profile#association-requests";
    if (notification.type === "ASSOCIATION_ACCEPTED") return "/messages";
    if (notification.type === "PROJECT_REQUEST") return `/teams/${notification.targetId}/manage`;
    if (notification.type === "PROJECT_INVITE") return `/teams/${notification.targetId}`;
    return `/projects/${notification.targetId}`;
  }

  const nav = [
    { href: "/dashboard", label: t("nav.dashboard"), icon: faTableCellsLarge },
    { href: "/projects", label: t("nav.myProjects"), icon: faFolderOpen, countKey: "myProjects" as NavigationCountKey },
    { href: "/teams", label: t("nav.myTeam"), icon: faUsers, countKey: "myTeams" as NavigationCountKey },
    { href: "/discover", label: t("nav.discover"), icon: faCompass, countKey: "discoverProjects" as NavigationCountKey },
    { href: "/makers", label: t("nav.makers"), icon: faHandshake, countKey: "makers" as NavigationCountKey },
    { href: "/messages", label: t("nav.messages"), icon: faComments, countKey: "unreadMessages" as NavigationCountKey },
    { href: "/coding", label: "LynoraCoding", icon: faCode },
    { href: "/marketplace", label: t("nav.marketplace"), icon: faStore, countKey: "marketplaceItems" as NavigationCountKey },
    { href: "/top-makers", label: t("nav.topMakers"), icon: faTrophy, countKey: "topMakers" as NavigationCountKey },
  ];
  const visibleNav = nav;

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults({ people: [], projects: [], teams: [] });
      setActiveSearchIndex(-1);
      setSearchLoading(false);
      setSearchError(false);
      return;
    }

    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(false);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`, { signal: controller.signal });
        if (!response.ok) throw new Error("search_unavailable");
        const results = await response.json() as SearchResults;
        if (active) setSearchResults(results);
      } catch {
        if (active && !controller.signal.aborted) {
          setSearchResults({ people: [], projects: [], teams: [] });
          setSearchError(true);
        }
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  function closeMenu() {
    setMobileMenuOpen(false);
  }

  function searchResultCount() {
    return searchResults.people.length + searchResults.projects.length + searchResults.teams.length;
  }

  function searchOptionId(optionPrefix: string) {
    return activeSearchIndex >= 0 && activeSearchIndex < searchResultCount()
      ? `${optionPrefix}-${activeSearchIndex}`
      : undefined;
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const allResults: SearchResult[] = [
      ...searchResults.people.map((item) => ({ type: "person" as const, item })),
      ...searchResults.projects.map((item) => ({ type: "project" as const, item })),
      ...searchResults.teams.map((item) => ({ type: "team" as const, item })),
    ];
    const selectedResult = allResults[activeSearchIndex] ?? allResults[0];
    if (selectedResult) {
      const href = selectedResult.type === "person"
        ? `/makers/${encodeURIComponent(selectedResult.item.handle ?? selectedResult.item.id)}`
        : selectedResult.type === "project"
          ? `/projects/${selectedResult.item.id}`
          : `/teams/${selectedResult.item.id}`;
      router.push(href);
      setSearchOpen(false);
      setMobileSearchOpen(false);
    }
  }

  function renderSearchResults(listId: string, optionPrefix: string) {
    const hasResults = searchResults.people.length + searchResults.projects.length + searchResults.teams.length > 0;
    if (!searchOpen || searchQuery.trim().length < 2) return null;

    return (
      <div id={listId} role="listbox" className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border border-midnight-border bg-midnight-card shadow-card">
        {searchLoading ? (
          <p className="px-4 py-3 text-sm text-ink-muted">{isFrench ? "Recherche…" : "Searching…"}</p>
        ) : searchError ? (
          <p className="px-4 py-3 text-sm text-ink-muted">{isFrench ? "Recherche indisponible." : "Search is unavailable."}</p>
        ) : hasResults ? (
          (() => {
            let optionIndex = 0;
            const sections: { key: SearchResult["type"]; label: string; results: SearchResult[] }[] = [
              { key: "person", label: isFrench ? "Personnes" : "People", results: searchResults.people.map((item) => ({ type: "person", item })) },
              { key: "project", label: isFrench ? "Projets" : "Projects", results: searchResults.projects.map((item) => ({ type: "project", item })) },
              { key: "team", label: isFrench ? "Équipes" : "Teams", results: searchResults.teams.map((item) => ({ type: "team", item })) },
            ];
            return sections.filter(({ results }) => results.length > 0).map(({ key, label, results }) => (
              <div key={key} role="group" aria-label={label}>
                <p className="border-b border-midnight-border px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  {label}
                </p>
                {results.map((result) => {
                  const index = optionIndex++;
                  const presentation = result.type === "person"
                    ? {
                        title: result.item.name ?? (result.item.handle ? `@${result.item.handle}` : (isFrench ? "Personne" : "Person")),
                        subtitle: [result.item.handle && `@${result.item.handle}`, result.item.headline].filter(Boolean).join(" · "),
                        href: `/makers/${encodeURIComponent(result.item.handle ?? result.item.id)}`,
                        image: result.item.image,
                      }
                    : result.type === "project"
                      ? {
                          title: result.item.title,
                          subtitle: `${result.item.tagline} · ${result.item.creator.handle ? `@${result.item.creator.handle}` : result.item.creator.name ?? "maker"}`,
                          href: `/projects/${result.item.id}`,
                          image: result.item.logoUrl,
                        }
                      : {
                          title: result.item.teamName ?? result.item.title,
                          subtitle: `${result.item.tagline} · ${result.item.creator.handle ? `@${result.item.creator.handle}` : result.item.creator.name ?? "maker"}`,
                          href: `/teams/${result.item.id}`,
                          image: result.item.logoUrl,
                        };

                  return (
                    <Link
                      key={`${key}-${result.item.id}`}
                      id={`${optionPrefix}-${index}`}
                      role="option"
                      aria-selected={activeSearchIndex === index}
                      href={presentation.href}
                      onClick={() => {
                        setSearchOpen(false);
                        setMobileSearchOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-3 border-b border-midnight-border/70 px-4 py-3 last:border-0 hover:bg-midnight-deep/50 focus:bg-midnight-deep/50 focus:outline-none",
                        activeSearchIndex === index && "bg-midnight-deep/50",
                      )}
                    >
                      <Avatar src={presentation.image} name={presentation.title} size={34} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">{presentation.title}</span>
                        {presentation.subtitle && <span className="mt-1 block truncate text-xs text-ink-muted">{presentation.subtitle}</span>}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ));
          })()
        ) : (
          <p className="px-4 py-3 text-sm text-ink-muted">
          {isFrench ? "Aucun résultat trouvé." : "No matching results found."}
          </p>
        )}
      </div>
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b border-midnight-border bg-midnight-deep/90 backdrop-blur-xl">
      <div className={cn("relative mx-auto flex h-16 w-full items-center gap-3 px-4 sm:px-6 xl:pr-8", isAdminArea && "lg:pl-72")}>
        <button
          type="button"
          aria-label={mobileMenuOpen
            ? (locale === "fr" ? "Fermer le menu" : "Close menu")
            : (locale === "fr" ? "Ouvrir le menu" : "Open menu")}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-primary-navigation"
          onClick={() => setMobileMenuOpen((open) => !open)}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-midnight-border text-ink-muted transition hover:bg-midnight-card/70 hover:text-ink lg:hidden"
        >
          <FontAwesomeIcon icon={mobileMenuOpen ? faXmark : faBars} className="h-[19px] w-[19px]" aria-hidden="true" />
        </button>

        <div className={cn(
          "relative min-w-0 max-w-md flex-1",
          mobileSearchOpen
            ? "absolute left-16 right-4 top-3 z-50 w-auto max-w-none flex-none sm:static sm:w-full sm:max-w-md sm:flex-1"
            : "hidden sm:block",
          isAdminArea && "lg:ml-4",
        )}>
          <form role="search" onSubmit={submitSearch}>
            <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-ink-muted" />
            <input
              type="search"
              role="combobox"
              aria-label={isFrench ? "Rechercher des personnes, projets et équipes" : "Search people, projects, and teams"}
              aria-expanded={searchOpen && searchQuery.trim().length >= 2}
              aria-controls="topnav-search-results"
              aria-activedescendant={searchOptionId("topnav-search-option")}
              aria-autocomplete="list"
              autoComplete="off"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setActiveSearchIndex(-1);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSearchOpen(false);
                  setMobileSearchOpen(false);
                }
                if (event.key === "ArrowDown" && searchResultCount()) {
                  event.preventDefault();
                  setActiveSearchIndex((index) => Math.min(index + 1, searchResultCount() - 1));
                }
                if (event.key === "ArrowUp" && searchResultCount()) {
                  event.preventDefault();
                  setActiveSearchIndex((index) => Math.max(index - 1, 0));
                }
              }}
              placeholder={isFrench ? "Rechercher une personne, un projet ou une équipe…" : "Search people, projects, and teams…"}
              autoFocus={mobileSearchOpen}
              className="h-10 w-full rounded-lg border border-midnight-border bg-midnight-card/55 pl-10 pr-12 text-sm text-ink placeholder:text-ink-muted/80 outline-none transition focus:border-gold/50 focus:bg-midnight-card focus:ring-2 focus:ring-gold/15"
            />
            <button
              type="button"
              aria-label={isFrench ? "Fermer la recherche" : "Close search"}
              onClick={() => {
                setSearchOpen(false);
                setMobileSearchOpen(false);
              }}
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-ink-muted hover:bg-midnight-deep hover:text-ink sm:hidden"
            >
              <FontAwesomeIcon icon={faXmark} className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>

          {renderSearchResults("topnav-search-results", "topnav-search-option")}
        </div>

        <div className={cn("ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2", mobileSearchOpen && "hidden sm:flex")}>
          <button
            type="button"
            aria-label={isFrench ? "Rechercher des personnes, projets et équipes" : "Search people, projects, and teams"}
            aria-expanded={mobileSearchOpen}
            aria-controls="mobile-topnav-search"
            onClick={() => setMobileSearchOpen((open) => !open)}
            className="mr-3 grid h-10 w-10 place-items-center rounded-lg text-ink-muted transition hover:bg-midnight-card/70 hover:text-ink sm:hidden"
          >
            <FontAwesomeIcon icon={faMagnifyingGlass} className="h-[19px] w-[19px]" aria-hidden="true" />
          </button>
          <Link
                href="/messages"
                title={t("nav.messages")}
                aria-label={t("nav.messages")}
                aria-current={pathname.startsWith("/messages") ? "page" : undefined}
                className={cn(
                  "relative grid h-10 w-10 place-items-center rounded-lg transition",
                  pathname.startsWith("/messages") ? "bg-gold/10 text-gold-soft" : "text-ink-muted hover:bg-midnight-card/70 hover:text-ink",
                )}
              >
                <FontAwesomeIcon icon={faComments} className="h-[19px] w-[19px]" aria-hidden="true" />
                <NavigationCountBadge count={navigationCounts.badgeCounts?.unreadMessages} className="absolute -right-0.5 -top-0.5" />
              </Link>

              <div className="relative">
                <button
                  type="button"
                  title={t("notifications.title")}
                  aria-label={t("notifications.title")}
                  aria-expanded={notificationsOpen}
                  aria-controls="notification-popover"
                  onClick={() => setNotificationsOpen((open) => !open)}
                  className={cn(
                    "relative grid h-10 w-10 place-items-center rounded-lg transition",
                    notificationsOpen ? "bg-gold/10 text-gold-soft" : "text-ink-muted hover:bg-midnight-card/70 hover:text-ink",
                  )}
                >
                  <FontAwesomeIcon icon={faBell} className="h-[19px] w-[19px]" aria-hidden="true" />
                  <NavigationCountBadge count={unreadNotifications} className="absolute -right-0.5 -top-0.5" />
                </button>
                {notificationsOpen && (
                  <div id="notification-popover" className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-midnight-border bg-midnight-card shadow-card">
                    <div className="flex items-center justify-between gap-3 border-b border-midnight-border px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gold/10 text-gold-soft"><FontAwesomeIcon icon={faBell} className="h-4 w-4" aria-hidden="true" /></div>
                        <div>
                          <h2 className="text-sm font-semibold text-ink">{t("notifications.title")}</h2>
                          <p className="mt-0.5 text-xs text-ink-muted">{unreadNotifications ? t("notifications.unread", { count: unreadNotifications }) : t("notifications.allCaughtUp")}</p>
                        </div>
                      </div>
                      {unreadNotifications > 0 && <button type="button" onClick={() => markNotificationRead.mutate({ all: true })} disabled={markNotificationRead.isPending} title={t("notifications.markAllRead")} aria-label={t("notifications.markAllRead")} className="grid h-8 w-8 place-items-center rounded-md text-ink-muted hover:bg-midnight-deep hover:text-gold-soft"><FontAwesomeIcon icon={faCheckDouble} className="h-[15px] w-[15px]" aria-hidden="true" /></button>}
                    </div>
                    <div className="max-h-[min(60vh,24rem)] overflow-y-auto p-2">
                      {notificationQuery.isLoading ? <div className="space-y-2 p-2" aria-busy="true"><div className="skeleton h-12" /><div className="skeleton h-12" /></div> : notifications.length ? (
                        <ul className="space-y-1">
                          {notifications.map((notification) => (
                            <li key={notification.id}>
                              <Link href={notificationHref(notification)} onClick={() => { setNotificationsOpen(false); if (!notification.readAt) markNotificationRead.mutate({ id: notification.id }); }} className={`block rounded-lg px-3 py-2.5 transition hover:bg-midnight-deep ${notification.readAt ? "" : "bg-gold/5"}`}>
                                <span className="flex items-start gap-2.5">
                                  <Avatar src={notification.actor?.image ?? null} name={notification.actor?.name ?? notification.actor?.handle ?? "Maker"} size={30} />
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-xs leading-relaxed text-ink">{notificationText(notification)}</span>
                                    <time dateTime={notification.createdAt} title={new Date(notification.createdAt).toLocaleString(locale)} className="mt-1 block text-[10px] text-ink-muted">{notificationTime(notification.createdAt)}</time>
                                  </span>
                                  {!notification.readAt && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-label={t("notifications.unreadLabel")} />}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : <p className="px-3 py-6 text-center text-xs text-ink-muted">{notificationQuery.isError ? t("notifications.loadError") : t("notifications.empty")}</p>}
                    </div>
                  </div>
                )}
              </div>
          <div className="relative ml-1 sm:ml-2">
            <button
              type="button"
              aria-label={isFrench ? "Ouvrir le profil" : "Open profile"}
              aria-expanded={profileOpen}
              aria-controls="topnav-profile-menu"
              onClick={() => setProfileOpen((open) => !open)}
              className={cn(
                "flex h-10 items-center gap-2 rounded-lg px-1.5 transition hover:bg-midnight-card/70 sm:px-2",
                profileOpen && "bg-midnight-card/70",
              )}
            >
              <Avatar src={session?.user?.image} name={profileName} size={36} />
              <span className="hidden max-w-28 truncate text-sm font-medium text-ink md:block">
                {profileName}
              </span>
              <FontAwesomeIcon icon={faChevronDown} className="hidden h-[15px] w-[15px] text-ink-muted md:block" aria-hidden="true" />
            </button>
            {profileOpen && (
              <div id="topnav-profile-menu" className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-xl border border-midnight-border bg-midnight-card shadow-card">
                <Link
                  href="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="block border-b border-midnight-border px-4 py-3 transition hover:bg-midnight-deep/50"
                >
                  <p className="truncate text-sm font-semibold text-ink">{session?.user?.name ?? t("common.maker")}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    {session?.user?.handle ? `@${session.user.handle}` : t("nav.profile")}
                  </p>
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-3 text-sm text-ink-muted transition hover:bg-midnight-deep/50 hover:text-ink"
                >
                  <FontAwesomeIcon icon={faGear} className="h-4 w-4" aria-hidden="true" />{t("nav.settings")}
                </Link>
                {isAdmin && <Link
                  href="/admin"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 border-t border-midnight-border px-4 py-3 text-sm font-semibold text-gold-soft transition hover:bg-midnight-deep/50 hover:text-gold"
                >
                  <FontAwesomeIcon icon={faShieldHalved} className="h-4 w-4" aria-hidden="true" />{t("nav.admin")}
                </Link>}
                <button
                  type="button"
                  onClick={() => { setProfileOpen(false); void logout(); }}
                  className="flex w-full items-center gap-2.5 border-t border-midnight-border px-4 py-3 text-left text-sm text-ink-muted transition hover:bg-midnight-deep/50 hover:text-ink"
                >
                  <FontAwesomeIcon icon={faRightFromBracket} className="h-4 w-4" aria-hidden="true" />{t("nav.logout")}
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {mobileMenuOpen && (
        <div id="mobile-primary-navigation" className="absolute inset-x-0 top-full z-50 h-[calc(100dvh-4rem)] lg:hidden">
          <button type="button" onClick={closeMenu} aria-label={locale === "fr" ? "Fermer le menu" : "Close menu"} className="absolute inset-0 bg-black/60" />
          <aside className="absolute inset-y-0 left-0 flex w-[min(20rem,calc(100vw-3rem))] flex-col border-r border-midnight-border bg-midnight-deep shadow-2xl">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-midnight-border px-4">
              <Link href="/dashboard" onClick={closeMenu} className="flex items-center"><Logo size={36} withWordmark priority /></Link>
            </div>
            <Link href="/projects/new" onClick={closeMenu} className="btn-gold mx-4 mt-4">
              <FontAwesomeIcon icon={faPlus} className="h-4 w-4" aria-hidden="true" />
              {t("nav.createProject")}
            </Link>
            <nav aria-label={locale === "fr" ? "Navigation principale" : "Primary navigation"} className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
              <div className="grid gap-1">
            {visibleNav.map(({ href, label, icon: Icon, countKey }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={closeMenu}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition",
                    active ? "bg-gold/10 text-gold-soft" : "text-ink-muted hover:bg-midnight-card/70 hover:text-ink",
                  )}
                >
                  <FontAwesomeIcon icon={Icon} className="h-[18px] w-[18px]" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {countKey && <NavigationCountBadge count={navigationCounts.badgeCounts?.[countKey]} />}
                </Link>
              );
            })}
              </div>
          </nav>
            <div className="shrink-0 border-t border-midnight-border p-3">
              <Link href="/profile" onClick={closeMenu} className="flex min-w-0 items-center gap-3 rounded-lg p-2 transition hover:bg-midnight-card/60">
                <Avatar src={session?.user?.image} name={profileName} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{profileName}</span>
                  <span className="block truncate text-xs text-ink-muted">{session?.user?.handle ? `@${session.user.handle}` : t("nav.profile")}</span>
                </span>
              </Link>
              <div className="mt-2 flex items-center justify-between border-t border-midnight-border pt-2">
                <Link href="/settings" onClick={closeMenu} className="flex items-center gap-2 rounded-md px-2 py-2 text-xs text-ink-muted hover:bg-midnight-card hover:text-ink">
                  <FontAwesomeIcon icon={faGear} className="h-4 w-4" aria-hidden="true" />{t("nav.settings")}
                </Link>
                <LanguageSwitcher compact />
              </div>
            </div>
          </aside>
        </div>
      )}
      {logoutOverlay}
    </header>
  );
}

export default TopNav;
