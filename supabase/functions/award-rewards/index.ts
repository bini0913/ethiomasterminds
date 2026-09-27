import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RewardRequest {
  userId: string;
  quizId: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  timeTaken: number;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Authentication required" }, 401);
    }

    const token = authHeader.slice("Bearer ".length);
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: authData, error: authError } = await admin.auth.getUser(token);

    if (authError || !authData.user) {
      return json({ error: "Invalid authentication token" }, 401);
    }

    const body: RewardRequest = await req.json();
    const { userId, quizId, score, correctAnswers, totalQuestions, timeTaken } = body;

    if (userId !== authData.user.id) {
      return json({ error: "You can only award rewards for your own account" }, 403);
    }
    if (!quizId || typeof quizId !== "string" || quizId.length > 200) {
      return json({ error: "Invalid quizId" }, 400);
    }
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      return json({ error: "Invalid score" }, 400);
    }
    if (!Number.isInteger(correctAnswers) || !Number.isInteger(totalQuestions) ||
        totalQuestions <= 0 || correctAnswers < 0 || correctAnswers > totalQuestions) {
      return json({ error: "Invalid quiz result" }, 400);
    }
    if (!Number.isFinite(timeTaken) || timeTaken < 0 || timeTaken > 24 * 60 * 60) {
      return json({ error: "Invalid timeTaken" }, 400);
    }

    const baseXP = 10;
    const accuracyBonus = Math.floor((correctAnswers / totalQuestions) * 50);
    const speedBonus = timeTaken < 60 ? 20 : timeTaken < 120 ? 10 : 0;
    const perfectBonus = correctAnswers === totalQuestions ? 25 : 0;
    const totalXP = baseXP + accuracyBonus + speedBonus + perfectBonus;

    const baseCoins = 5;
    const performanceCoins = Math.floor((score / 100) * 15);
    const totalCoins = baseCoins + performanceCoins;

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("xp, level")
      .eq("id", authData.user.id)
      .single();

    if (profileError || !profile) throw profileError ?? new Error("Profile not found");

    const newXP = (profile.xp || 0) + totalXP;
    const xpForNextLevel = Math.max(100, (profile.level || 1) * 100);
    const newLevel = newXP >= xpForNextLevel ? (profile.level || 1) + 1 : (profile.level || 1);

    const { error: xpError } = await admin
      .from("profiles")
      .update({ xp: newXP, level: newLevel })
      .eq("id", authData.user.id);
    if (xpError) throw xpError;

    const { data: currency, error: currencyReadError } = await admin
      .from("user_currency")
      .select("coins")
      .eq("user_id", authData.user.id)
      .single();
    if (currencyReadError) throw currencyReadError;

    const { error: currencyError } = await admin
      .from("user_currency")
      .update({ coins: (currency.coins || 0) + totalCoins })
      .eq("user_id", authData.user.id);
    if (currencyError) throw currencyError;

    const { error: resultError } = await admin
      .from("quiz_results")
      .insert({
        student_id: authData.user.id,
        quiz_id: quizId,
        score,
        correct_answers: correctAnswers,
        total_questions: totalQuestions,
        time_taken: timeTaken,
        xp_earned: totalXP,
      });
    if (resultError) throw resultError;

    const today = new Date().toISOString().split("T")[0];
    const { data: missions } = await admin
      .from("user_missions")
      .select("id, progress, daily_missions!inner(mission_type, target_value)")
      .eq("user_id", authData.user.id)
      .eq("mission_date", today)
      .eq("completed", false);

    for (const mission of missions ?? []) {
      const missionType = (mission as any).daily_missions.mission_type;
      const targetValue = (mission as any).daily_missions.target_value;
      let newProgress = mission.progress;

      if (missionType === "complete_quizzes") newProgress += 1;
      else if (missionType === "score_percentage" && score >= 90) newProgress += 1;
      else if (missionType === "correct_answers") newProgress += correctAnswers;

      await admin
        .from("user_missions")
        .update({ progress: newProgress, completed: newProgress >= targetValue })
        .eq("id", mission.id);
    }

    const { data: streak } = await admin
      .from("user_streaks")
      .select("*")
      .eq("user_id", authData.user.id)
      .single();

    if (streak) {
      const lastActivity = streak.last_activity_date ? new Date(streak.last_activity_date) : null;
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      let newStreak = streak.current_streak;

      if (!lastActivity) newStreak = 1;
      else {
        const lastActivityDate = new Date(lastActivity);
        lastActivityDate.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((todayDate.getTime() - lastActivityDate.getTime()) / 86400000);
        if (diffDays === 1) newStreak += 1;
        else if (diffDays > 1) newStreak = 1;
      }

      await admin
        .from("user_streaks")
        .update({
          current_streak: newStreak,
          longest_streak: Math.max(streak.longest_streak, newStreak),
          last_activity_date: todayDate.toISOString(),
        })
        .eq("user_id", authData.user.id);
    }

    await checkAchievements(admin, authData.user.id, {
      totalXP: newXP,
      correctAnswers,
      totalQuestions,
      score,
      level: newLevel,
    });

    return json({
      success: true,
      xpAwarded: totalXP,
      coinsAwarded: totalCoins,
      newLevel,
      leveledUp: newLevel > profile.level,
    });
  } catch (error) {
    console.error("Error awarding rewards:", error);
    return json({ error: error instanceof Error ? error.message : "Reward processing failed" }, 500);
  }
});

async function checkAchievements(supabase: any, userId: string, stats: any) {
  const { data: achievements } = await supabase.from("achievements").select("*");
  if (!achievements) return;

  const { data: userAchievements } = await supabase
    .from("user_achievements")
    .select("achievement_id, completed")
    .eq("user_id", userId);

  const completedIds = new Set(
    (userAchievements || []).filter((a: any) => a.completed).map((a: any) => a.achievement_id),
  );

  for (const achievement of achievements) {
    if (completedIds.has(achievement.id)) continue;

    let progress = 0;
    let shouldComplete = false;

    switch (achievement.requirement_type) {
      case "xp_total":
        progress = stats.totalXP;
        shouldComplete = progress >= achievement.requirement_value;
        break;
      case "level_reach":
        progress = stats.level;
        shouldComplete = progress >= achievement.requirement_value;
        break;
      case "perfect_score":
        if (stats.score === 100) {
          progress = 1;
          shouldComplete = progress >= achievement.requirement_value;
        }
        break;
    }

    if (progress > 0) {
      await supabase.from("user_achievements").upsert(
        {
          user_id: userId,
          achievement_id: achievement.id,
          progress,
          completed: shouldComplete,
          unlocked_at: shouldComplete ? new Date().toISOString() : null,
        },
        { onConflict: "user_id,achievement_id" },
      );
    }
  }
}
