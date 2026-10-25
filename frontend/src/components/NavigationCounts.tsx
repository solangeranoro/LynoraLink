"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavigationCounts = {
  unreadMessages: number;
  myProjects: number;
  myTeams: number;
  discoverProjects: number;
  marketplaceItems: number;
  topMakers: number;
  makers: number;
};

export type NavigationCountKey = keyof NavigationCounts;

type NavigationCountsResponse = { counts: NavigationCounts };
type SeenCountsState = { userId: string | null; ready: boolean; counts: Partial<NavigationCounts> };

const countKeyByPath: Record<string, NavigationCountKey> = {
  "/messages": "unreadMessages",
  "/projects": "myProjects",
  "/teams": "myTeams",
  "/discover": "discoverProjects",
  "/makers": "makers",
  "/marketplace": "marketplaceItems",
  "/top-makers": "topMakers",
};

export function useNavigationCounts(userId?: string) {
  const pathname = usePathname();
  const [seenState, setSeenState] = useState<SeenCountsState>({ userId: null, ready: false, counts: {} });
  const query = useQuery({
    queryKey: ["navigation-counts", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await fetch("/api/navigation/counts");
      if (!response.ok) throw new Error("navigation_counts_load_failed");
      return response.json() as Promise<NavigationCountsResponse>;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!userId) {
      setSeenState({ userId: null, ready: true, counts: {} });
      return;
    }

    let counts: Partial<NavigationCounts> = {};
    try {
      const stored = localStorage.getItem(`lynora:navigation-seen:${userId}`);
      if (stored) counts = JSON.parse(stored) as Partial<NavigationCounts>;
    } catch {
      counts = {};
    }
    setSeenState({ userId, ready: true, counts });
  }, [userId]);

  const activeCountKey = pathname ? countKeyByPath[pathname] : undefined;
  useEffect(() => {
    if (!userId || !query.data || !activeCountKey || !seenState.ready || seenState.userId !== userId) return;

    const currentCount = query.data.counts[activeCountKey];
    if (seenState.counts[activeCountKey] === currentCount) return;

    const counts = { ...seenState.counts, [activeCountKey]: currentCount };
    try {
      localStorage.setItem(`lynora:navigation-seen:${userId}`, JSON.stringify(counts));
    } catch {
      // Keep the current tab's badge cleared even when persistent storage is unavailable.
    }
    setSeenState({ userId, ready: true, counts });
  }, [activeCountKey, query.data, seenState, userId]);

  const badgeCounts = query.data && seenState.ready && seenState.userId === userId
    ? (Object.fromEntries(
      Object.entries(query.data.counts).map(([key, count]) => {
        const countKey = key as NavigationCountKey;
        const seenCount = seenState.counts[countKey] ?? 0;
        return [key, activeCountKey === countKey ? 0 : Math.max(0, count - seenCount)];
      }),
    ) as NavigationCounts)
    : undefined;

  return { ...query, badgeCounts };
}

export function NavigationCountBadge({ count, className }: { count?: number; className?: string }) {
  if (!count) return null;

  return (
    <span className={cn(
      "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold leading-none tabular-nums text-white",
      className,
    )}>
      {count > 99 ? "99+" : count}
    </span>
  );
}
