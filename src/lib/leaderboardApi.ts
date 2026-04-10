import { supabase } from "@/integrations/supabase/client";

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
}

const toGradeNumber = (grade: string | null): number | null => {
  if (!grade) return null;
  const parsed = Number(grade);
  return Number.isNaN(parsed) ? null : parsed;
};

export const rankScore = (user: LeaderboardUser) => {
  const performance = user.matchesPlayed > 0 ? user.wins / user.matchesPlayed : 0;
  return user.xp + user.accuracy * 15 + performance * 300 + user.contributions * 2;
};

export const tierFromUser = (user: LeaderboardUser) => {
  const score = rankScore(user);
  if (score >= 9800) return "Legend";
  if (score >= 7800) return "Master";
  if (score >= 6200) return "Diamond";
  if (score >= 4400) return "Gold";
  if (score >= 2600) return "Silver";
  return "Bronze";
};

export const tierStyle = (tier: string) => {
  switch (tier) {
    case "Legend":
      return "from-fuchsia-500 to-amber-300 text-white shadow-[0_0_25px_rgba(217,70,239,0.55)]";
    case "Master":
      return "from-violet-500 to-indigo-500 text-white shadow-[0_0_18px_rgba(99,102,241,0.45)]";
    case "Diamond":
      return "from-cyan-500 to-sky-500 text-white shadow-[0_0_18px_rgba(14,165,233,0.45)]";
    case "Gold":
      return "from-yellow-500 to-amber-500 text-white shadow-[0_0_18px_rgba(245,158,11,0.45)]";
    case "Silver":
      return "from-slate-300 to-slate-500 text-white shadow-[0_0_15px_rgba(148,163,184,0.4)]";
    default:
      return "from-amber-700 to-orange-900 text-white shadow-[0_0_15px_rgba(146,64,14,0.35)]";
  }
};

export async function fetchLeaderboardUsers(): Promise<LeaderboardUser[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [profilesRes, streakRes, weeklyRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,name,username,avatar,avatar_config,grade,xp,level,rank,badges"),
    supabase.from("user_streaks").select("user_id,current_streak"),
    supabase
      .from("question_attempts")
      .select("user_id,is_correct")
      .gte("created_at", since),
  ]);

  if (profilesRes.error) throw profilesRes.error;

  const streakByUser = new Map<string, number>();
  (streakRes.data ?? []).forEach((row) => streakByUser.set(row.user_id, row.current_streak));

  const weeklyByUser = new Map<string, { attempts: number; correct: number }>();
  (weeklyRes.data ?? []).forEach((row) => {
    const current = weeklyByUser.get(row.user_id) ?? { attempts: 0, correct: 0 };
    current.attempts += 1;
    if (row.is_correct) current.correct += 1;
    weeklyByUser.set(row.user_id, current);
  });

  const users = await Promise.all(
    (profilesRes.data ?? []).map(async (profile) => {
      const { data: statsData } = await supabase.rpc("get_user_stats", { p_user_id: profile.id });
      const stats = (statsData ?? {}) as Record<string, unknown>;

      const correct = Number(stats.total_correct_answers ?? 0);
      const total = Number(stats.total_questions_answered ?? 0);
      const wins = Number(stats.total_wins ?? 0);
      const losses = Number(stats.total_losses ?? 0);
      const contributions = Number(stats.study_time_hours ?? 0) * 10;
      const weekly = weeklyByUser.get(profile.id) ?? { attempts: 0, correct: 0 };

      return {
        id: profile.id,
        username: profile.username ?? profile.name,
        name: profile.name,
        avatar: profile.avatar,
        avatarConfig: (profile.avatar_config as Record<string, unknown> | null) ?? null,
        grade: toGradeNumber(profile.grade),
        xp: profile.xp ?? 0,
        level: profile.level ?? 1,
        rank: profile.rank,
        badges: profile.badges ?? [],
        streak: streakByUser.get(profile.id) ?? 0,
        accuracy: total > 0 ? Number(((correct / total) * 100).toFixed(1)) : 0,
        matchesPlayed: wins + losses,
        wins,
        losses,
        contributions,
        weeklyScore: weekly.attempts * 10 + weekly.correct * 5,
      } as LeaderboardUser;
    }),
  );

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
