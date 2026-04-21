

# Migrate from Lovable Cloud to Your Own Supabase Project

I'll fully migrate your project — schema, data, edge functions, storage files, and the frontend connection — from Lovable Cloud to your own Supabase project. You won't have to do any SQL or file copying manually.

## What gets migrated

**Database (62 tables, ~1,500+ rows of real data):**
- All user data: 114 profiles, 111 user_roles, 125 user_currency, 92 quiz_results
- All content: 48 quizzes, 426 questions, 17 library books, 15 achievements, 11 daily missions, 9 flashcards, 9 avatar items
- All social / multiplayer / classroom tables (followers, friends, chat groups, messages, multiplayer rooms, classes, assignments, tournaments, etc.)
- 65 migration files (schema, RLS policies, helper functions, triggers, enums)
- 27 SECURITY DEFINER functions (`has_role`, `add_xp`, `finalize_match`, `multiplayer_*`, `get_dashboard_data`, etc.)

**Edge Functions (12):**
ai-academic-insights, ai-helper, ai-study-planner, ai-tutor, analyze-learning-dna, assign-role, award-rewards, daily-missions, generate-parent-insights, library-ai, redeem-access-code, voice-evaluate

**Storage (3 buckets, ~180 MB):**
- `library-files` (20 PDFs, 167 MB)
- `library-thumbnails` (19 images, 6 MB)
- `social-images` (7 images, 6 MB)
- `avatars` and `quiz-assets` buckets (empty but recreated with correct policies)

**Frontend reconnection:**
- Update `.env` to point at your new project URL + anon key
- Regenerate `src/integrations/supabase/types.ts` against your new project
- Update `supabase/config.toml` with your new `project_id`

## What I need from you

To do this automatically, please provide these from **your own Supabase project** (Project Settings → API and Project Settings → Database):

1. **Project URL** — e.g. `https://xxxxxxxxxxxx.supabase.co`
2. **Project Ref** — the `xxxxxxxxxxxx` part (also visible in your dashboard URL)
3. **Anon (publishable) key** — public, safe to share
4. **Service role key** — secret; needed to bypass RLS while inserting data and creating storage objects
5. **Database connection string** — from Database → Connection string → URI (the `postgresql://postgres:...@...pooler.supabase.com:5432/postgres` one). Needed for fast bulk schema + data load via `pg_dump`/`psql`.
6. **Secrets to set on the new project** — confirm you want me to also re-add: `LOVABLE_API_KEY` (only if you'll keep using Lovable AI Gateway from edge functions). `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are auto-provided by Supabase to edge functions, so I won't duplicate those.

> Note: I cannot read these from your new Supabase project — Lovable has no access to it. Paste them in the chat and I'll use them only for this migration.

## Migration steps (executed automatically once you provide credentials)

1. **Schema** — Run all 65 migration files in order against your new DB via `psql` using your connection string. This recreates every table, enum (`app_role`), RLS policy, function, and trigger exactly.
2. **Data** — Use `pg_dump --data-only --schema=public` from current Lovable Cloud DB → pipe into `psql` on your new DB. Foreign-key-safe ordering preserved. `auth.users` rows are exported separately (since your users live in `auth.users`) and re-inserted using the admin API so passwords/emails/IDs are preserved.
3. **Storage** — Download every object from the 3 buckets via the current Storage API, recreate the buckets on your new project (with same public/private settings), and upload using the new service-role key. Object paths are preserved exactly so existing `pdf_path` / `thumbnail_path` / `avatar_url` columns keep working.
4. **Edge Functions** — Deploy all 12 functions to your new project using the Supabase Management API + your service role key. `supabase/config.toml` `verify_jwt` settings are preserved.
5. **Frontend rewire** — Overwrite `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`), update `supabase/config.toml` `project_id`, and regenerate `src/integrations/supabase/types.ts` from the new project.
6. **Verify** — Run `scripts/check-supabase-connection.mjs` against the new project, count rows on a few key tables on both sides to confirm parity, and do a smoke test of `/auth/v1/settings`, `/rest/v1/profiles`, and a sample edge function.
7. **Fix the existing build errors** — While doing the migration I'll also fix the unrelated TypeScript errors currently breaking the build (`TournamentHub.tsx`, `leaderboardApi.ts`, `RealTimeRoom.tsx`, `LibraryPage.tsx`, `ManagerDashboard.tsx`, and the `library-ai` `openai` import) so the new project builds cleanly.

## Important caveats

- **`auth.users` migration**: Supabase doesn't allow direct INSERT into `auth.users` via SQL. I'll use the Admin API (`/auth/v1/admin/users`) with your service role key to recreate each user with their original UUID, email, and encrypted password hash so all foreign keys (`profiles.id`, `user_roles.user_id`, etc.) keep matching. OAuth identities (Google logins) require users to re-link on first login — Supabase doesn't expose a way to copy OAuth identity rows across projects.
- **Realtime publication**: I'll re-add the necessary tables to `supabase_realtime` publication on the new project (chat, multiplayer, invites).
- **Lovable Cloud disconnection**: Per Lovable's rules, Lovable Cloud cannot be disabled on this project once enabled. After migration the app will use *your* Supabase, but the Cloud connection metadata stays. That's harmless — your `.env` and client point at your project, so all reads/writes go to your DB.
- **Downtime**: ~5–15 minutes during the data dump+restore depending on size. Best to do this while no users are active.

## What you'll have at the end

- Your own Supabase project hosting 100% of the data, schema, functions, and files
- This Lovable project building & running against your Supabase, with no remaining Lovable Cloud dependency for runtime
- Full ownership: you can manage RLS, run SQL, view logs, and pay Supabase directly

