import { supabase } from "@/integrations/supabase/client";
import { fetchFollowerCounts, fetchLeaderboardUsers } from "@/lib/leaderboardApi";

const CACHE_TTL_MS = 20_000;
const cacheKey = (userId: string) => `profile-prefetch:${userId}`;

export const readPrefetchedProfile = <T>(userId: string): T | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { timestamp: number; data: T };
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      window.sessionStorage.removeItem(cacheKey(userId));
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
};

export const prefetchProfileBundle = async (userId: string) => {
  if (!userId || typeof window === "undefined") return;

  try {
    const [leaderboardRows, followerCounts, profileRes, statsRes] = await Promise.all([
      fetchLeaderboardUsers(),
      fetchFollowerCounts(userId),
      supabase
        .from("profiles")
        .select("id,name,username,avatar,avatar_config,level,xp,grade,created_at")
        .eq("id", userId)
        .maybeSingle(),
      supabase.rpc("get_user_stats", { p_user_id: userId }),
    ]);

    const payload = {
      leaderboardRows,
      followerCounts,
      profile: profileRes.data,
      stats: statsRes.data ?? {},
    };

    window.sessionStorage.setItem(cacheKey(userId), JSON.stringify({ timestamp: Date.now(), data: payload }));
  } catch {
    // Silent best-effort prefetch.
  }
};
