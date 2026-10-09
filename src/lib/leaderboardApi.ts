import { supabase } from "@/integrations/supabase/client";
import { getRankTierByLevel } from "@/lib/rankSystem";

export interface LeaderboardUser {
  id: string;
  username: string;
  name: string;
  avatar: string | null;
  avatarConfig: Record<string, unknown> | null;
  grade: number | null;
  xp: number;
  level: number;
  rank: string | null;
  badges: string[];
  streak: number;
  accuracy: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  contributions: number;
  weeklyScore: number;
  monthlyScore: number;
  totalXp: number;
  seasonXp: number;
  coins: number;
  activeTitle: string | null;
}

export interface ClassCompetitionRow {
  classId: string;
  className: string;
  studentCount: number;
  totalClassXp: number;
  classScore: number;
}

export const rankScore = (user: LeaderboardUser) => {
  const performance = user.matchesPlayed > 0 ? user.wins / user.matchesPlayed : 0;
  return user.seasonXp + user.accuracy * 15 + performance * 300 + user.contributions * 2;
};

export const tierFromUser = (user: LeaderboardUser) => getRankTierByLevel(user.level).name;

export const tierStyle = (level: number) => {
  const tierConfig = getRankTierByLevel(level);
  return `${tierConfig.colorClass} ${tierConfig.glowClass}`;
};

/**
 * Load a safe, aggregated leaderboard through a SECURITY DEFINER RPC.
 * Direct profile and attempt reads are correctly restricted by RLS to each
 * user's own records, so querying those tables directly cannot produce a
 * complete global leaderboard for regular students.
 */
export async function fetchLeaderboardUsers(): Promise<LeaderboardUser[]> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [profilesRes, streakRes, attemptsRes, currencyRes, rankedStatsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,name,username,avatar,avatar_config,grade,xp,season_xp,level,rank,badges"),
    supabase.from("user_streaks").select("user_id,current_streak"),
    supabase
      .from("question_attempts")
      .select("user_id,is_correct,created_at")
      .gte("created_at", monthAgo),
    supabase.from("user_currency").select("user_id,coins"),
    supabase.from("multiplayer_ranked_stats").select("user_id,total_points,matches_played,wins"),
  ]);

  if (error) {
    console.error("fetchLeaderboardUsers RPC error", error);
    throw error;
  }

  const streakByUser = new Map<string, number>();
  (streakRes.data ?? []).forEach((row) => streakByUser.set(row.user_id, row.current_streak));

  const coinsByUser = new Map<string, number>();
  (currencyRes.data ?? []).forEach((row) => coinsByUser.set(row.user_id, row.coins ?? 0));

  if (streakRes.error) console.warn("Leaderboard streak data unavailable", streakRes.error);
  if (attemptsRes.error) console.warn("Leaderboard quiz-attempt data unavailable", attemptsRes.error);
  if (currencyRes.error) console.warn("Leaderboard currency data unavailable", currencyRes.error);
  if (rankedStatsRes.error) console.warn("Leaderboard multiplayer stats unavailable", rankedStatsRes.error);

  const rankedStatsByUser = new Map<string, { points: number; matches: number; wins: number }>();
  (rankedStatsRes.data ?? []).forEach((row) => rankedStatsByUser.set(row.user_id, {
    points: Number(row.total_points ?? 0),
    matches: Number(row.matches_played ?? 0),
    wins: Number(row.wins ?? 0),
  }));

  const weeklyByUser = new Map<string, { attempts: number; correct: number }>();
  const monthlyByUser = new Map<string, { attempts: number; correct: number }>();
  (attemptsRes.data ?? []).forEach((row) => {
    const m = monthlyByUser.get(row.user_id) ?? { attempts: 0, correct: 0 };
    m.attempts += 1;
    if (row.is_correct) m.correct += 1;
    monthlyByUser.set(row.user_id, m);
    if (row.created_at >= weekAgo) {
      const w = weeklyByUser.get(row.user_id) ?? { attempts: 0, correct: 0 };
      w.attempts += 1;
      if (row.is_correct) w.correct += 1;
      weeklyByUser.set(row.user_id, w);
    }
  });

  const users: LeaderboardUser[] = (profilesRes.data ?? []).map((profile) => {
    const weekly = weeklyByUser.get(profile.id) ?? { attempts: 0, correct: 0 };
    const monthly = monthlyByUser.get(profile.id) ?? { attempts: 0, correct: 0 };
    const accuracy = monthly.attempts > 0 ? Number(((monthly.correct / monthly.attempts) * 100).toFixed(1)) : 0;
    const rankedStats = rankedStatsByUser.get(profile.id) ?? { points: 0, matches: 0, wins: 0 };
    const totalXp = Number(profile.xp ?? 0);
    const computedLevel = Math.max(Number(profile.level ?? 1), Math.floor(totalXp / 100) + 1);
    const computedRank = profile.rank ?? (totalXp >= 10000 ? "Legend" : totalXp >= 5000 ? "Master" : totalXp >= 2000 ? "Diamond" : totalXp >= 1000 ? "Platinum" : totalXp >= 500 ? "Gold" : totalXp >= 200 ? "Silver" : "Bronze");
    return {
      id: profile.id,
      username: profile.username ?? profile.name ?? "user",
      name: profile.name ?? profile.username ?? "Unknown User",
      avatar: profile.avatar ?? null,
      avatarConfig: (profile.avatar_config as Record<string, unknown> | null) ?? null,
      grade: toGradeNumber(profile.grade),
      xp: Number(profile.xp ?? 0),
      level: computedLevel,
      rank: computedRank,
      badges: profile.badges ?? [],
      streak: streakByUser.get(profile.id) ?? 0,
      accuracy,
      matchesPlayed: rankedStats.matches,
      wins: rankedStats.wins,
      losses: Math.max(0, rankedStats.matches - rankedStats.wins),
      contributions: 0,
      weeklyScore: weekly.attempts * 10 + weekly.correct * 5,
      monthlyScore: monthly.attempts * 10 + monthly.correct * 5,
      totalXp,
      seasonXp: Number((profile as any).season_xp ?? totalXp),
      coins: coinsByUser.get(profile.id) ?? 0,
      activeTitle: null,
    } as LeaderboardUser;
  });

  return users;
}

export async function fetchFollowing(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("followers" as never)
    .select("following_id")
    .eq("follower_id", userId);

  if (error) return [];
  return (data as Array<{ following_id: string }>).map((x) => x.following_id);
}

export async function followUser(followerId: string, followingId: string) {
  const { error } = await supabase.from("followers" as never).insert({ follower_id: followerId, following_id: followingId } as never);
  if (error) throw error;
  await supabase.from("social_notifications" as never).insert({
    user_id: followingId,
    actor_id: followerId,
    notification_type: "new_follower",
    message: "A user started following you",
  } as never);
}

export async function unfollowUser(followerId: string, followingId: string) {
  const { error } = await supabase
    .from("followers" as never)
    .delete()
    .eq("follower_id", followerId)
    .eq("following_id", followingId);
  if (error) throw error;
}

export async function fetchFollowerCounts(userId: string) {
  const [followers, following] = await Promise.all([
    supabase.from("followers" as never).select("id", { count: "exact", head: true }).eq("following_id", userId),
    supabase.from("followers" as never).select("id", { count: "exact", head: true }).eq("follower_id", userId),
  ]);

  return {
    followers: followers.count ?? 0,
    following: following.count ?? 0,
  };
}

export async function createFollowChallenge(challengerId: string, challengedId: string) {
  const { error } = await supabase.from("follow_challenges" as never).insert({
    challenger_id: challengerId,
    challenged_id: challengedId,
    status: "pending",
  } as never);

  if (error) throw error;
}

export async function fetchClassCompetitionLeaderboard(limit = 10): Promise<ClassCompetitionRow[]> {
  const { data, error } = await (supabase as any).rpc("get_class_competition_leaderboard", { p_limit: limit });
  if (error) throw error;

  return ((data ?? []) as any[]).map((row) => ({
    classId: row.class_id,
    className: row.class_name,
    studentCount: Number(row.student_count ?? 0),
    totalClassXp: Number(row.total_class_xp ?? 0),
    classScore: Number(row.class_score ?? 0),
  }));
}
