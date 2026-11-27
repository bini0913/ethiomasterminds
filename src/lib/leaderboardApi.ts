import { db } from "@/integrations/untypedClient";
import { supabase } from "@/integrations/supabase/client";
import { getRankTierByLevel } from "@/lib/rankSystem";

const toGradeNumber = (grade: string | null): number | null => {
  if (!grade) return null;
  const match = grade.match(/\d+/);
  if (match) return Number(match[0]);
  if (/^(k|kg|kindergarten)$/i.test(grade.trim())) return 0;
  const parsed = Number(grade);
  return Number.isNaN(parsed) ? null : parsed;
};

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
 * Load leaderboard data from Supabase. Profile XP is the base ranking source;
 * ranked multiplayer statistics contribute match results and points when available.
 * Quiz-period scores only reflect real question_attempts records.
 */
export async function fetchLeaderboardUsers(): Promise<LeaderboardUser[]> {
  // Prefer the server-side projection so the leaderboard is not dependent on
  // broad SELECT access to profiles, attempts, streaks, or multiplayer tables.
  const { data: leaderboardData, error: leaderboardError } = await db.rpc("get_student_leaderboard");

  if (leaderboardError) {
    console.error("Privacy-filtered leaderboard RPC failed; refusing an unfiltered fallback.", leaderboardError);
    throw leaderboardError;
  }
  if (!Array.isArray(leaderboardData)) {
    throw new Error("Privacy-filtered leaderboard RPC returned an invalid response.");
  }

  return leaderboardData.map((row: any) => {
    const totalXp = Number(row.total_xp ?? row.xp ?? 0);
    const level = Math.max(Number(row.level ?? 1), Math.floor(totalXp / 100) + 1);
    return {
      id: row.id,
      username: row.username ?? row.name ?? "user",
      name: row.name ?? row.username ?? "Unknown User",
      avatar: row.avatar ?? null,
      avatarConfig: (row.avatar_config as Record<string, unknown> | null) ?? null,
      grade: typeof row.grade === "number" ? row.grade : toGradeNumber(row.grade == null ? null : String(row.grade)),
      xp: Number(row.xp ?? totalXp),
      level,
      rank: row.rank ?? (totalXp >= 10000 ? "Legend" : totalXp >= 5000 ? "Master" : totalXp >= 2000 ? "Diamond" : totalXp >= 1000 ? "Platinum" : totalXp >= 500 ? "Gold" : totalXp >= 200 ? "Silver" : "Bronze"),
      badges: Array.isArray(row.badges) ? row.badges : [],
      streak: Number(row.streak ?? 0),
      accuracy: Number(row.accuracy ?? 0),
      matchesPlayed: Number(row.matches_played ?? 0),
      wins: Number(row.wins ?? 0),
      losses: Number(row.losses ?? 0),
      contributions: Number(row.contributions ?? 0),
      weeklyScore: Number(row.weekly_score ?? 0),
      monthlyScore: Number(row.monthly_score ?? 0),
      totalXp,
      seasonXp: Number(row.season_xp ?? totalXp),
      coins: Number(row.coins ?? 0),
      activeTitle: row.active_title ?? null,
    } as LeaderboardUser;
  });
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
  const { error } = await db.from("followers" as never).insert({ follower_id: followerId, following_id: followingId } as never);
  if (error) throw error;
  await db.from("social_notifications" as never).insert({
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
    db.from("followers" as never).select("id", { count: "exact", head: true }).eq("following_id", userId),
    db.from("followers" as never).select("id", { count: "exact", head: true }).eq("follower_id", userId),
  ]);

  return {
    followers: followers.count ?? 0,
    following: following.count ?? 0,
  };
}

export async function createFollowChallenge(challengerId: string, challengedId: string) {
  const { error } = await db.from("follow_challenges" as never).insert({
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
