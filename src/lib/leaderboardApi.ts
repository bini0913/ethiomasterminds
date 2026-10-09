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
  const { data, error } = await (supabase as any).rpc("get_student_leaderboard");

  if (error) {
    console.error("fetchLeaderboardUsers RPC error", error);
    throw error;
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    username: String(row.username ?? row.name ?? "learner"),
    name: String(row.name ?? row.username ?? "Learner"),
    avatar: (row.avatar as string | null) ?? null,
    avatarConfig: (row.avatar_config as Record<string, unknown> | null) ?? null,
    grade: row.grade == null ? null : Number(row.grade),
    xp: Number(row.xp ?? 0),
    level: Number(row.level ?? 1),
    rank: (row.rank as string | null) ?? null,
    badges: Array.isArray(row.badges) ? (row.badges as string[]) : [],
    streak: Number(row.streak ?? 0),
    accuracy: Number(row.accuracy ?? 0),
    matchesPlayed: Number(row.matches_played ?? 0),
    wins: Number(row.wins ?? 0),
    losses: Number(row.losses ?? 0),
    contributions: Number(row.contributions ?? 0),
    weeklyScore: Number(row.weekly_score ?? 0),
    monthlyScore: Number(row.monthly_score ?? 0),
    totalXp: Number(row.total_xp ?? row.xp ?? 0),
    seasonXp: Number(row.season_xp ?? row.xp ?? 0),
    // Currency and title are private/profile-specific features, not leaderboard data.
    coins: Number(row.coins ?? 0),
    activeTitle: (row.active_title as string | null) ?? null,
  }));
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
