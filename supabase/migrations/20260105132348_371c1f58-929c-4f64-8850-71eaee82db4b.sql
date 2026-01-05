-- =============================================
-- SEED DATA: Default Avatar Items
-- =============================================

INSERT INTO public.avatar_items (name, category, price_coins, price_gems, rarity, preview, description) VALUES
-- Clothing
('Cool Jacket', 'clothing', 100, 0, 'common', '🧥', 'A stylish jacket for your avatar'),
('Crown Hat', 'clothing', 0, 5, 'epic', '👑', 'Show off your royal status'),
('Wizard Robe', 'clothing', 250, 0, 'rare', '🧙', 'Magical robes for the wise'),
('Sports Jersey', 'clothing', 150, 0, 'common', '👕', 'Rep your favorite team'),
('Ninja Outfit', 'clothing', 0, 10, 'legendary', '🥷', 'Stealth and style combined'),
-- Accessories
('Cool Shades', 'accessories', 50, 0, 'common', '😎', 'Look cool in any situation'),
('Headphones', 'accessories', 75, 0, 'common', '🎧', 'Music lover essential'),
('Magic Wand', 'accessories', 0, 3, 'rare', '✨', 'Cast spells of knowledge'),
('Trophy', 'accessories', 200, 0, 'rare', '🏆', 'Show your achievements'),
('Dragon Pet', 'accessories', 0, 15, 'legendary', '🐉', 'A fierce companion'),
-- Backgrounds
('Galaxy', 'backgrounds', 100, 0, 'rare', '🌌', 'A cosmic backdrop'),
('Forest', 'backgrounds', 50, 0, 'common', '🌲', 'Nature vibes'),
('City Lights', 'backgrounds', 75, 0, 'common', '🌃', 'Urban atmosphere'),
('Rainbow', 'backgrounds', 0, 5, 'epic', '🌈', 'Colorful and bright'),
('Volcano', 'backgrounds', 0, 8, 'legendary', '🌋', 'Hot and dangerous'),
-- Effects
('Sparkles', 'effects', 100, 0, 'rare', '✨', 'Glitter and shine'),
('Fire Aura', 'effects', 0, 5, 'epic', '🔥', 'Blazing presence'),
('Ice Crystals', 'effects', 150, 0, 'rare', '❄️', 'Cool and collected'),
('Lightning', 'effects', 0, 10, 'legendary', '⚡', 'Electric personality'),
('Hearts', 'effects', 50, 0, 'common', '💕', 'Spread the love');

-- =============================================
-- SEED DATA: Default Achievements
-- =============================================

INSERT INTO public.achievements (name, description, icon, category, requirement_type, requirement_value, reward_xp, reward_coins, rarity) VALUES
-- Quiz achievements
('First Steps', 'Complete your first quiz', '🎯', 'quiz', 'quizzes_completed', 1, 50, 10, 'common'),
('Quiz Enthusiast', 'Complete 10 quizzes', '📚', 'quiz', 'quizzes_completed', 10, 100, 25, 'common'),
('Quiz Master', 'Complete 50 quizzes', '🏅', 'quiz', 'quizzes_completed', 50, 250, 50, 'rare'),
('Quiz Legend', 'Complete 100 quizzes', '👑', 'quiz', 'quizzes_completed', 100, 500, 100, 'legendary'),
('Perfect Score', 'Get 100% on a quiz', '⭐', 'quiz', 'perfect_scores', 1, 100, 20, 'rare'),
('Perfectionist', 'Get 10 perfect scores', '💎', 'quiz', 'perfect_scores', 10, 300, 75, 'epic'),
-- Social achievements
('Friendly', 'Add your first friend', '🤝', 'social', 'friends_added', 1, 50, 10, 'common'),
('Popular', 'Have 10 friends', '🌟', 'social', 'friends_added', 10, 150, 30, 'rare'),
('Social Butterfly', 'Have 25 friends', '🦋', 'social', 'friends_added', 25, 300, 75, 'epic'),
-- Multiplayer achievements
('Competitor', 'Play your first multiplayer game', '🎮', 'multiplayer', 'multiplayer_games', 1, 75, 15, 'common'),
('Champion', 'Win 10 multiplayer games', '🏆', 'multiplayer', 'multiplayer_wins', 10, 250, 50, 'rare'),
('Undefeated', 'Win 5 games in a row', '🔥', 'multiplayer', 'win_streak', 5, 500, 100, 'legendary'),
-- Streak achievements
('Dedicated', 'Login 7 days in a row', '📅', 'streak', 'login_streak', 7, 100, 25, 'common'),
('Committed', 'Login 30 days in a row', '💪', 'streak', 'login_streak', 30, 300, 75, 'rare'),
('Unstoppable', 'Login 100 days in a row', '🚀', 'streak', 'login_streak', 100, 1000, 250, 'legendary');

-- =============================================
-- SEED DATA: Default Daily Missions
-- =============================================

INSERT INTO public.daily_missions (title, description, icon, mission_type, target_value, reward_xp, reward_coins) VALUES
('Quiz Time', 'Complete 1 quiz today', '📝', 'complete_quiz', 1, 25, 5),
('Study Hard', 'Complete 3 quizzes today', '📚', 'complete_quiz', 3, 75, 15),
('Perfect Run', 'Get a perfect score on any quiz', '⭐', 'score_perfect', 1, 100, 25),
('Social Player', 'Play 1 multiplayer game', '🎮', 'play_multiplayer', 1, 50, 10),
('Team Player', 'Play 3 multiplayer games', '👥', 'play_multiplayer', 3, 100, 25),
('Making Friends', 'Add a new friend', '🤝', 'add_friend', 1, 50, 10),
('High Scorer', 'Earn 100 XP today', '🎯', 'earn_xp', 100, 50, 10),
('XP Hunter', 'Earn 500 XP today', '🏆', 'earn_xp', 500, 150, 35);