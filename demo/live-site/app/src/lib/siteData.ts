/**
 * The public site's shared reads. The header, the footer and every page ask for the same handful of lists, so each
 * request is made once and reused while the tab is open; Retry drops the cache and asks again.
 */

import { useApi, type ApiState } from "@/hooks/useApi";
import {
  siteGet,
  type SiteDeadline,
  type SiteIndustrySummary,
  type SiteLocation,
  type SiteServiceSummary,
  type SiteTeamMember,
} from "@/lib/practice";

const cache = new Map<string, Promise<unknown>>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as Promise<T> | undefined;
  if (hit) return hit;
  const fresh = load();
  cache.set(key, fresh);
  fresh.catch(() => cache.delete(key));
  return fresh;
}

export function clearSiteCache() {
  cache.clear();
}

function useCached<T>(key: string, load: () => Promise<T>, enabled = true): ApiState<T> {
  const state = useApi<T>(enabled ? () => cached(key, load) : null, [key, enabled]);
  const { reload } = state;
  return {
    ...state,
    reload: () => {
      cache.delete(key);
      reload();
    },
  };
}

export const useSiteServices = () =>
  useCached("services", () => siteGet<{ services: SiteServiceSummary[] }>("/services"));

export const useSiteIndustries = () =>
  useCached("industries", () => siteGet<{ industries: SiteIndustrySummary[] }>("/industries"));

export const useSiteTeam = () => useCached("team", () => siteGet<{ team: SiteTeamMember[] }>("/team"));

export const useSiteLocations = () =>
  useCached("locations", () => siteGet<{ locations: SiteLocation[] }>("/locations"));

/** The next few deadlines, for the mega-menu's feature card and the home page. */
export const useUpcomingDeadlines = () =>
  useCached("deadlines", () => siteGet<{ deadlines: SiteDeadline[] }>("/deadlines"));

export function deadlineAfter(deadlines: SiteDeadline[], today = new Date()): SiteDeadline | undefined {
  const stamp = today.toISOString().slice(0, 10);
  return deadlines.filter((d) => d.date >= stamp).sort((a, b) => a.date.localeCompare(b.date))[0];
}
