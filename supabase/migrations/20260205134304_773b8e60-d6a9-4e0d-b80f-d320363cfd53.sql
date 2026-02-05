-- Enable realtime for critical tables
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'multiplayer_rooms', 'room_players', 'room_state', 'room_answers', 'room_chat_messages',
        'social_posts', 'social_post_comments', 'social_post_reactions',
        'messages', 'group_messages', 'lobby_messages', 'user_presence', 'friends'
    ])
    LOOP
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        EXCEPTION WHEN duplicate_object THEN
            NULL; -- Already exists, skip
        END;
    END LOOP;
END $$;