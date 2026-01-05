-- =============================================
-- PHASE 1: CORE TABLES FOR FULL FUNCTIONALITY
-- =============================================

-- 1. User Currency (coins and gems per user)
CREATE TABLE public.user_currency (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  coins INTEGER NOT NULL DEFAULT 100,
  gems INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_currency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own currency" ON public.user_currency
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own currency" ON public.user_currency
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert currency" ON public.user_currency
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all currency" ON public.user_currency
FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- 2. Avatar Items (store items available for purchase)
CREATE TABLE public.avatar_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price_coins INTEGER DEFAULT 0,
  price_gems INTEGER DEFAULT 0,
  rarity TEXT DEFAULT 'common',
  preview TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.avatar_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view avatar items" ON public.avatar_items
FOR SELECT USING (true);

CREATE POLICY "Admins can manage avatar items" ON public.avatar_items
FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- 3. User Inventory (purchased items per user)
CREATE TABLE public.user_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.avatar_items(id) ON DELETE CASCADE,
  equipped BOOLEAN DEFAULT false,
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_id)
);

ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own inventory" ON public.user_inventory
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own inventory" ON public.user_inventory
FOR ALL USING (auth.uid() = user_id);

-- 4. Achievements Definition
CREATE TABLE public.achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL,
  requirement_type TEXT NOT NULL,
  requirement_value INTEGER NOT NULL DEFAULT 1,
  reward_xp INTEGER DEFAULT 0,
  reward_coins INTEGER DEFAULT 0,
  rarity TEXT DEFAULT 'common',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view achievements" ON public.achievements
FOR SELECT USING (true);

CREATE POLICY "Admins can manage achievements" ON public.achievements
FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- 5. User Achievements
CREATE TABLE public.user_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  unlocked_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, achievement_id)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements" ON public.user_achievements
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own achievements" ON public.user_achievements
FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all achievements" ON public.user_achievements
FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- 6. Friends
CREATE TABLE public.friends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own friend relationships" ON public.friends
FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can send friend requests" ON public.friends
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own friend relationships" ON public.friends
FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete own friend relationships" ON public.friends
FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- 7. Messages
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages" ON public.messages
FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages" ON public.messages
FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update own received messages" ON public.messages
FOR UPDATE USING (auth.uid() = receiver_id);

-- 8. Multiplayer Rooms (create first without RLS that references room_players)
CREATE TABLE public.multiplayer_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_players INTEGER NOT NULL DEFAULT 4,
  password TEXT,
  subject TEXT,
  difficulty TEXT DEFAULT 'medium',
  question_count INTEGER DEFAULT 10,
  game_mode TEXT DEFAULT 'classic',
  status TEXT NOT NULL DEFAULT 'waiting',
  current_question INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.multiplayer_rooms ENABLE ROW LEVEL SECURITY;

-- 9. Room Players (create before RLS policies that need it)
CREATE TABLE public.room_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.multiplayer_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  is_ready BOOLEAN DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;

-- Now add RLS policies for rooms (after room_players exists)
CREATE POLICY "Anyone can view public rooms" ON public.multiplayer_rooms
FOR SELECT USING (password IS NULL OR host_id = auth.uid() OR EXISTS (
  SELECT 1 FROM public.room_players WHERE room_id = multiplayer_rooms.id AND user_id = auth.uid()
));

CREATE POLICY "Authenticated users can create rooms" ON public.multiplayer_rooms
FOR INSERT WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update own rooms" ON public.multiplayer_rooms
FOR UPDATE USING (auth.uid() = host_id);

CREATE POLICY "Hosts can delete own rooms" ON public.multiplayer_rooms
FOR DELETE USING (auth.uid() = host_id);

-- RLS for room players
CREATE POLICY "Anyone can view room players" ON public.room_players
FOR SELECT USING (true);

CREATE POLICY "Users can join rooms" ON public.room_players
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own player status" ON public.room_players
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can leave rooms" ON public.room_players
FOR DELETE USING (auth.uid() = user_id);

-- 10. Tournaments
CREATE TABLE public.tournaments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  max_participants INTEGER DEFAULT 100,
  entry_fee_coins INTEGER DEFAULT 0,
  entry_fee_gems INTEGER DEFAULT 0,
  prize_description TEXT,
  prize_coins INTEGER DEFAULT 0,
  prize_gems INTEGER DEFAULT 0,
  subject TEXT,
  difficulty TEXT DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'upcoming',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tournaments" ON public.tournaments
FOR SELECT USING (true);

CREATE POLICY "Admins can manage tournaments" ON public.tournaments
FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- 11. Tournament Participants
CREATE TABLE public.tournament_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  rank INTEGER,
  registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, user_id)
);

ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view participants" ON public.tournament_participants
FOR SELECT USING (true);

CREATE POLICY "Users can register for tournaments" ON public.tournament_participants
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own participation" ON public.tournament_participants
FOR UPDATE USING (auth.uid() = user_id);

-- 12. Daily Missions Definition
CREATE TABLE public.daily_missions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT DEFAULT '🎯',
  mission_type TEXT NOT NULL,
  target_value INTEGER NOT NULL DEFAULT 1,
  reward_xp INTEGER DEFAULT 50,
  reward_coins INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active missions" ON public.daily_missions
FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage missions" ON public.daily_missions
FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- 13. User Daily Mission Progress
CREATE TABLE public.user_missions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES public.daily_missions(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  claimed BOOLEAN DEFAULT false,
  mission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(user_id, mission_id, mission_date)
);

ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own missions" ON public.user_missions
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own missions" ON public.user_missions
FOR ALL USING (auth.uid() = user_id);

-- 14. User Streaks
CREATE TABLE public.user_streaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own streak" ON public.user_streaks
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own streak" ON public.user_streaks
FOR ALL USING (auth.uid() = user_id);

-- 15. Lobby Chat Messages
CREATE TABLE public.lobby_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lobby_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view lobby messages" ON public.lobby_messages
FOR SELECT USING (true);

CREATE POLICY "Authenticated users can send lobby messages" ON public.lobby_messages
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 16. User Online Status
CREATE TABLE public.user_presence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'online',
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view presence" ON public.user_presence
FOR SELECT USING (true);

CREATE POLICY "Users can manage own presence" ON public.user_presence
FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user_extras()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_currency (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_streaks (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_presence (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_profile_created_add_extras
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_extras();

CREATE TRIGGER update_user_currency_updated_at
  BEFORE UPDATE ON public.user_currency
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_friends_updated_at
  BEFORE UPDATE ON public.friends
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_streaks_updated_at
  BEFORE UPDATE ON public.user_streaks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- ENABLE REALTIME
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.multiplayer_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lobby_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friends;