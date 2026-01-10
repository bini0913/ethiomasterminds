import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, userId } = await req.json();

    console.log(`Daily missions action: ${action} for user: ${userId}`);

    if (action === 'assign') {
      // Assign daily missions to a specific user
      const today = new Date().toISOString().split('T')[0];

      // Check if user already has missions for today
      const { data: existingMissions } = await supabase
        .from('user_missions')
        .select('id')
        .eq('user_id', userId)
        .eq('mission_date', today)
        .limit(1);

      if (existingMissions && existingMissions.length > 0) {
        return new Response(
          JSON.stringify({ message: 'Missions already assigned for today' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get active missions
      const { data: activeMissions } = await supabase
        .from('daily_missions')
        .select('*')
        .eq('is_active', true);

      if (!activeMissions || activeMissions.length === 0) {
        return new Response(
          JSON.stringify({ message: 'No active missions available' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Randomly select 3 missions
      const shuffled = activeMissions.sort(() => 0.5 - Math.random());
      const selectedMissions = shuffled.slice(0, 3);

      // Assign missions to user
      const inserts = selectedMissions.map(mission => ({
        user_id: userId,
        mission_id: mission.id,
        mission_date: today,
        progress: 0,
        completed: false,
        claimed: false
      }));

      const { error } = await supabase
        .from('user_missions')
        .insert(inserts);

      if (error) {
        console.error('Error assigning missions:', error);
        throw error;
      }

      console.log(`Assigned ${selectedMissions.length} missions to user ${userId}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          missionsAssigned: selectedMissions.length 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'reset_all') {
      // Reset all users' missions (for scheduled cron job)
      const today = new Date().toISOString().split('T')[0];

      // Get all active users (those with activity in last 7 days)
      const { data: activeUsers } = await supabase
        .from('user_streaks')
        .select('user_id')
        .gte('last_activity_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (!activeUsers || activeUsers.length === 0) {
        return new Response(
          JSON.stringify({ message: 'No active users to assign missions' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get active missions
      const { data: activeMissions } = await supabase
        .from('daily_missions')
        .select('*')
        .eq('is_active', true);

      if (!activeMissions || activeMissions.length === 0) {
        return new Response(
          JSON.stringify({ message: 'No active missions available' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let assignedCount = 0;

      for (const user of activeUsers) {
        // Check if already has missions
        const { data: existing } = await supabase
          .from('user_missions')
          .select('id')
          .eq('user_id', user.user_id)
          .eq('mission_date', today)
          .limit(1);

        if (existing && existing.length > 0) continue;

        // Randomly select 3 missions
        const shuffled = activeMissions.sort(() => 0.5 - Math.random());
        const selectedMissions = shuffled.slice(0, 3);

        const inserts = selectedMissions.map(mission => ({
          user_id: user.user_id,
          mission_id: mission.id,
          mission_date: today,
          progress: 0,
          completed: false,
          claimed: false
        }));

        await supabase.from('user_missions').insert(inserts);
        assignedCount++;
      }

      console.log(`Assigned missions to ${assignedCount} users`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          usersProcessed: assignedCount 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'claim') {
      // Claim a completed mission reward
      const { missionId } = await req.json();

      // Get mission details
      const { data: userMission } = await supabase
        .from('user_missions')
        .select(`
          *,
          daily_missions!inner(reward_xp, reward_coins)
        `)
        .eq('id', missionId)
        .eq('user_id', userId)
        .single();

      if (!userMission) {
        return new Response(
          JSON.stringify({ error: 'Mission not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!userMission.completed) {
        return new Response(
          JSON.stringify({ error: 'Mission not completed yet' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (userMission.claimed) {
        return new Response(
          JSON.stringify({ error: 'Reward already claimed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const rewardXP = userMission.daily_missions.reward_xp || 0;
      const rewardCoins = userMission.daily_missions.reward_coins || 0;

      // Mark as claimed
      await supabase
        .from('user_missions')
        .update({ claimed: true })
        .eq('id', missionId);

      // Award XP
      if (rewardXP > 0) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('xp, level')
          .eq('id', userId)
          .single();

        if (profile) {
          const newXP = (profile.xp || 0) + rewardXP;
          let newLevel = profile.level;
          
          if (newXP >= profile.level * 100) {
            newLevel = profile.level + 1;
          }

          await supabase
            .from('profiles')
            .update({ xp: newXP, level: newLevel })
            .eq('id', userId);
        }
      }

      // Award coins
      if (rewardCoins > 0) {
        const { data: currency } = await supabase
          .from('user_currency')
          .select('coins')
          .eq('user_id', userId)
          .single();

        if (currency) {
          await supabase
            .from('user_currency')
            .update({ coins: currency.coins + rewardCoins })
            .eq('user_id', userId);
        }
      }

      console.log(`User ${userId} claimed mission ${missionId}: ${rewardXP} XP, ${rewardCoins} coins`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          xpAwarded: rewardXP,
          coinsAwarded: rewardCoins
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in daily-missions function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
