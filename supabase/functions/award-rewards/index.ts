import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RewardRequest {
  userId: string;
  quizId: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  timeTaken: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, quizId, score, correctAnswers, totalQuestions, timeTaken }: RewardRequest = await req.json();

    console.log(`Processing rewards for user ${userId}, quiz ${quizId}`);

    // Calculate XP based on performance
    const baseXP = 10;
    const accuracyBonus = Math.floor((correctAnswers / totalQuestions) * 50);
    const speedBonus = timeTaken < 60 ? 20 : timeTaken < 120 ? 10 : 0;
    const perfectBonus = correctAnswers === totalQuestions ? 25 : 0;
    const totalXP = baseXP + accuracyBonus + speedBonus + perfectBonus;

    // Calculate coins
    const baseCoins = 5;
    const performanceCoins = Math.floor((score / 100) * 15);
    const totalCoins = baseCoins + performanceCoins;

    console.log(`Awarding: ${totalXP} XP, ${totalCoins} coins`);

    // Update user profile XP
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('xp, level')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      throw profileError;
    }

    const newXP = (profile.xp || 0) + totalXP;
    const xpForNextLevel = profile.level * 100;
    let newLevel = profile.level;

    // Check for level up
    if (newXP >= xpForNextLevel) {
      newLevel = profile.level + 1;
      console.log(`User leveled up to ${newLevel}!`);
    }

    // Update profile
    await supabase
      .from('profiles')
      .update({ xp: newXP, level: newLevel })
      .eq('id', userId);

    // Add coins
    await supabase
      .from('user_currency')
      .update({ 
        coins: supabase.rpc('increment_coins', { amount: totalCoins, user_uuid: userId })
      })
      .eq('user_id', userId);

    // Actually just use raw update
    const { data: currency } = await supabase
      .from('user_currency')
      .select('coins')
      .eq('user_id', userId)
      .single();

    if (currency) {
      await supabase
        .from('user_currency')
        .update({ coins: currency.coins + totalCoins })
        .eq('user_id', userId);
    }

    // Save quiz result
    await supabase
      .from('quiz_results')
      .insert({
        student_id: userId,
        quiz_id: quizId,
        score,
        correct_answers: correctAnswers,
        total_questions: totalQuestions,
        time_taken: timeTaken,
        xp_earned: totalXP
      });

    // Update daily mission progress (quizzes completed)
    const today = new Date().toISOString().split('T')[0];
    const { data: missions } = await supabase
      .from('user_missions')
      .select(`
        id,
        progress,
        daily_missions!inner(mission_type, target_value)
      `)
      .eq('user_id', userId)
      .eq('mission_date', today)
      .eq('completed', false);

    if (missions) {
      for (const mission of missions) {
        const missionType = (mission as any).daily_missions.mission_type;
        const targetValue = (mission as any).daily_missions.target_value;
        let newProgress = mission.progress;

        if (missionType === 'complete_quizzes') {
          newProgress = mission.progress + 1;
        } else if (missionType === 'score_percentage' && score >= 90) {
          newProgress = mission.progress + 1;
        } else if (missionType === 'correct_answers') {
          newProgress = mission.progress + correctAnswers;
        }

        const completed = newProgress >= targetValue;

        await supabase
          .from('user_missions')
          .update({ progress: newProgress, completed })
          .eq('id', mission.id);
      }
    }

    // Update streak
    const { data: streak } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (streak) {
      const lastActivity = streak.last_activity_date ? new Date(streak.last_activity_date) : null;
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);

      let newStreak = streak.current_streak;
      
      if (lastActivity) {
        const lastActivityDate = new Date(lastActivity);
        lastActivityDate.setHours(0, 0, 0, 0);
        
        const diffDays = Math.floor((todayDate.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          newStreak = streak.current_streak + 1;
        } else if (diffDays > 1) {
          newStreak = 1;
        }
        // If same day, keep streak the same
      } else {
        newStreak = 1;
      }

      const longestStreak = Math.max(streak.longest_streak, newStreak);

      await supabase
        .from('user_streaks')
        .update({
          current_streak: newStreak,
          longest_streak: longestStreak,
          last_activity_date: todayDate.toISOString()
        })
        .eq('user_id', userId);
    }

    // Check for achievements
    await checkAchievements(supabase, userId, {
      totalXP: newXP,
      correctAnswers,
      totalQuestions,
      score,
      level: newLevel
    });

    return new Response(
      JSON.stringify({
        success: true,
        xpAwarded: totalXP,
        coinsAwarded: totalCoins,
        newLevel,
        leveledUp: newLevel > profile.level
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error awarding rewards:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function checkAchievements(supabase: any, userId: string, stats: any) {
  // Get all achievements
  const { data: achievements } = await supabase
    .from('achievements')
    .select('*');

  if (!achievements) return;

  // Get user's current achievements
  const { data: userAchievements } = await supabase
    .from('user_achievements')
    .select('achievement_id, completed')
    .eq('user_id', userId);

  const completedIds = new Set((userAchievements || []).filter((a: any) => a.completed).map((a: any) => a.achievement_id));

  for (const achievement of achievements) {
    if (completedIds.has(achievement.id)) continue;

    let progress = 0;
    let shouldComplete = false;

    switch (achievement.requirement_type) {
      case 'xp_total':
        progress = stats.totalXP;
        shouldComplete = progress >= achievement.requirement_value;
        break;
      case 'level_reach':
        progress = stats.level;
        shouldComplete = progress >= achievement.requirement_value;
        break;
      case 'perfect_score':
        if (stats.score === 100) {
          progress = 1;
          shouldComplete = progress >= achievement.requirement_value;
        }
        break;
      case 'quizzes_completed':
        // This would need cumulative tracking
        break;
    }

    if (progress > 0) {
      await supabase
        .from('user_achievements')
        .upsert({
          user_id: userId,
          achievement_id: achievement.id,
          progress,
          completed: shouldComplete,
          unlocked_at: shouldComplete ? new Date().toISOString() : null
        }, { onConflict: 'user_id,achievement_id' });
    }
  }
}
