-- =====================================================
-- COMPLETE SUPABASE INTEGRATION FOR MASTER MINDS
-- =====================================================

-- 1. ENSURE AUTH TRIGGER FOR NEW USERS (with extras)
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, name, username)
    VALUES (
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
        COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1))
    )
    ON CONFLICT (id) DO NOTHING;
    
    INSERT INTO public.user_currency (user_id) 
    VALUES (NEW.id) 
    ON CONFLICT DO NOTHING;
    
    INSERT INTO public.user_streaks (user_id) 
    VALUES (NEW.id) 
    ON CONFLICT DO NOTHING;
    
    INSERT INTO public.user_presence (user_id) 
    VALUES (NEW.id) 
    ON CONFLICT DO NOTHING;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. UNIQUE CONSTRAINTS
-- =====================================================

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_currency_user_id_key') THEN
        ALTER TABLE public.user_currency ADD CONSTRAINT user_currency_user_id_key UNIQUE (user_id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_streaks_user_id_key') THEN
        ALTER TABLE public.user_streaks ADD CONSTRAINT user_streaks_user_id_key UNIQUE (user_id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_presence_user_id_key') THEN
        ALTER TABLE public.user_presence ADD CONSTRAINT user_presence_user_id_key UNIQUE (user_id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'learning_dna_user_id_key') THEN
        ALTER TABLE public.learning_dna ADD CONSTRAINT learning_dna_user_id_key UNIQUE (user_id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_achievements_user_achievement_unique') THEN
        ALTER TABLE public.user_achievements ADD CONSTRAINT user_achievements_user_achievement_unique UNIQUE (user_id, achievement_id);
    END IF;
END $$;

-- 3. PERFORMANCE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_xp ON public.profiles(xp DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_level ON public.profiles(level DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_quizzes_subject ON public.quizzes(subject);
CREATE INDEX IF NOT EXISTS idx_quizzes_created_by ON public.quizzes(created_by);
CREATE INDEX IF NOT EXISTS idx_quizzes_is_approved ON public.quizzes(is_approved);
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON public.questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_student_id ON public.quiz_results(student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_quiz_id ON public.quiz_results(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_completed_at ON public.quiz_results(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_multiplayer_rooms_status ON public.multiplayer_rooms(status);
CREATE INDEX IF NOT EXISTS idx_multiplayer_rooms_host_id ON public.multiplayer_rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_room_players_room_id ON public.room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_room_players_user_id ON public.room_players(user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_author_id ON public.social_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_created_at ON public.social_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_post_comments_post_id ON public.social_post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_social_post_reactions_post_id ON public.social_post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON public.friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON public.friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friends_status ON public.friends(status);
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON public.classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_students_class_id ON public.class_students(class_id);
CREATE INDEX IF NOT EXISTS idx_class_students_student_id ON public.class_students(student_id);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON public.analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_subject ON public.analytics(subject);

-- 4. UPDATED_AT TRIGGERS
-- =====================================================

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_quizzes_updated_at ON public.quizzes;
CREATE TRIGGER update_quizzes_updated_at BEFORE UPDATE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_classes_updated_at ON public.classes;
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_social_posts_updated_at ON public.social_posts;
CREATE TRIGGER update_social_posts_updated_at BEFORE UPDATE ON public.social_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_chat_groups_updated_at ON public.chat_groups;
CREATE TRIGGER update_chat_groups_updated_at BEFORE UPDATE ON public.chat_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_learning_dna_updated_at ON public.learning_dna;
CREATE TRIGGER update_learning_dna_updated_at BEFORE UPDATE ON public.learning_dna FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_tutor_updated_at ON public.ai_tutor_conversations;
CREATE TRIGGER update_ai_tutor_updated_at BEFORE UPDATE ON public.ai_tutor_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_friends_updated_at ON public.friends;
CREATE TRIGGER update_friends_updated_at BEFORE UPDATE ON public.friends FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. STREAK UPDATE FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_user_streak(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_streak user_streaks%ROWTYPE;
    v_today date := CURRENT_DATE;
    v_yesterday date := CURRENT_DATE - INTERVAL '1 day';
BEGIN
    SELECT * INTO v_streak FROM user_streaks WHERE user_id = p_user_id;
    
    IF v_streak IS NULL THEN
        INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_activity_date)
        VALUES (p_user_id, 1, 1, v_today)
        RETURNING * INTO v_streak;
        RETURN jsonb_build_object('current_streak', 1, 'longest_streak', 1, 'streak_maintained', true);
    END IF;
    
    IF v_streak.last_activity_date = v_today THEN
        RETURN jsonb_build_object('current_streak', v_streak.current_streak, 'longest_streak', v_streak.longest_streak, 'streak_maintained', true);
    END IF;
    
    IF v_streak.last_activity_date = v_yesterday THEN
        UPDATE user_streaks SET 
            current_streak = current_streak + 1,
            longest_streak = GREATEST(longest_streak, current_streak + 1),
            last_activity_date = v_today, updated_at = now()
        WHERE user_id = p_user_id RETURNING * INTO v_streak;
        RETURN jsonb_build_object('current_streak', v_streak.current_streak, 'longest_streak', v_streak.longest_streak, 'streak_maintained', true);
    END IF;
    
    UPDATE user_streaks SET current_streak = 1, last_activity_date = v_today, updated_at = now()
    WHERE user_id = p_user_id RETURNING * INTO v_streak;
    RETURN jsonb_build_object('current_streak', 1, 'longest_streak', v_streak.longest_streak, 'streak_maintained', false);
END;
$$;

-- 6. DASHBOARD DATA FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile profiles%ROWTYPE;
    v_currency user_currency%ROWTYPE;
    v_streak user_streaks%ROWTYPE;
    v_stats jsonb;
    v_recent_quizzes jsonb;
    v_achievements_count integer;
BEGIN
    SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
    SELECT * INTO v_currency FROM user_currency WHERE user_id = p_user_id;
    SELECT * INTO v_streak FROM user_streaks WHERE user_id = p_user_id;
    v_stats := get_user_stats(p_user_id);
    
    SELECT COUNT(*) INTO v_achievements_count FROM user_achievements WHERE user_id = p_user_id AND completed = true;
    
    SELECT COALESCE(jsonb_agg(jsonb_build_object('quiz_id', qr.quiz_id, 'score', qr.score, 'completed_at', qr.completed_at, 'xp_earned', qr.xp_earned) ORDER BY qr.completed_at DESC), '[]'::jsonb) INTO v_recent_quizzes
    FROM (SELECT quiz_id, score, completed_at, xp_earned FROM quiz_results WHERE student_id = p_user_id ORDER BY completed_at DESC LIMIT 5) qr;
    
    RETURN jsonb_build_object(
        'profile', jsonb_build_object('id', v_profile.id, 'name', v_profile.name, 'username', v_profile.username, 'avatar', v_profile.avatar, 'avatar_config', v_profile.avatar_config, 'xp', v_profile.xp, 'level', v_profile.level, 'rank', v_profile.rank),
        'currency', jsonb_build_object('coins', COALESCE(v_currency.coins, 100), 'gems', COALESCE(v_currency.gems, 10)),
        'streak', jsonb_build_object('current', COALESCE(v_streak.current_streak, 0), 'longest', COALESCE(v_streak.longest_streak, 0), 'last_activity', v_streak.last_activity_date),
        'stats', v_stats, 'achievements_earned', v_achievements_count, 'recent_quizzes', v_recent_quizzes
    );
END;
$$;

-- 7. CHECK ACHIEVEMENTS FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.check_achievements(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_achievement RECORD;
    v_progress integer;
    v_newly_earned jsonb := '[]'::jsonb;
    v_stats jsonb;
BEGIN
    v_stats := get_user_stats(p_user_id);
    
    FOR v_achievement IN SELECT a.* FROM achievements a WHERE NOT EXISTS (SELECT 1 FROM user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = a.id AND ua.completed = true)
    LOOP
        v_progress := CASE v_achievement.requirement_type
            WHEN 'quizzes_completed' THEN (v_stats->>'total_quizzes')::integer
            WHEN 'xp_earned' THEN (v_stats->>'xp')::integer
            WHEN 'level_reached' THEN (v_stats->>'level')::integer
            WHEN 'streak_days' THEN (v_stats->>'current_streak')::integer
            WHEN 'accuracy' THEN (v_stats->>'accuracy')::integer
            ELSE 0
        END;
        
        INSERT INTO user_achievements (user_id, achievement_id, progress, completed, unlocked_at)
        VALUES (p_user_id, v_achievement.id, v_progress, v_progress >= v_achievement.requirement_value, CASE WHEN v_progress >= v_achievement.requirement_value THEN now() ELSE NULL END)
        ON CONFLICT (user_id, achievement_id) DO UPDATE SET
            progress = v_progress, completed = v_progress >= v_achievement.requirement_value,
            unlocked_at = CASE WHEN v_progress >= v_achievement.requirement_value AND user_achievements.unlocked_at IS NULL THEN now() ELSE user_achievements.unlocked_at END;
        
        IF v_progress >= v_achievement.requirement_value THEN
            v_newly_earned := v_newly_earned || jsonb_build_object('id', v_achievement.id, 'name', v_achievement.name, 'xp_reward', v_achievement.reward_xp, 'coins_reward', v_achievement.reward_coins);
            IF v_achievement.reward_xp > 0 THEN PERFORM add_xp(p_user_id, v_achievement.reward_xp); END IF;
            IF v_achievement.reward_coins > 0 THEN UPDATE user_currency SET coins = coins + v_achievement.reward_coins WHERE user_id = p_user_id; END IF;
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object('newly_earned', v_newly_earned, 'total_checked', (SELECT COUNT(*) FROM achievements));
END;
$$;