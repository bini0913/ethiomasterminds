# Early Learners Portal Redesign (KG to Grade 4)

Scope: only the Early tier (`getUserTier` = "early", KG to Grade 4). Grade 5-8 and 9-12 screens, Supabase auth/session bootstrap, and `UserContext` sign-in logic stay unchanged.

## Backend target (non-negotiable)

- The production database is Supabase project **mytbjkchvfybhyqcynnl**. My database tools here only reach Lovable Cloud, so I will not run any migration or data change on Lovable Cloud.
- Every schema change and seed comes as a numbered SQL file in `docs/sql/early/` (for example `2026-10-02-01-early-catalog.sql`). Each file can be re-run safely (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS`) and includes GRANTs, RLS, and a check query at the end. You run them in production in order.
- The app keeps using the existing client and `.env`. No new backend.
- If a production table is missing, the app falls back to bundled catalog content and must not crash. This fixes the current `/early-videos` crash.

## What exists today

- Routes: `/early-games`, `/early-quiz`, `/early-videos`, `/early-discover`, `/early-explore`, `/early-progress`, `/admin/early-content`, guarded by `EarlyTierOnlyRoute`. The home screen is `EarlyTierHome`.
- Games (`EarlyGamesPage.tsx`, about 19 KB, one file): 10 hardcoded games (number, word, shape, pattern, memory, odd, sort, animal, builder, coding) with KG-level content and no grade scaling.
- Quiz (`EarlyQuizPage.tsx`): 3 hardcoded sets (k, g1, g3) of 10 questions each. It sorts by weak skill but has no anti-repeat, no categories, and no teaching after a wrong answer.
- Videos (`EarlyVideosPage.tsx`): references `items` but the array is called `resources`, so the page crashes. It shows 4 external links that are the same for every grade.
- Discover and Explore: static arrays. Explore links out to Khan Kids.
- Rewards and progress: the `complete_early_activity` RPC (hardened over several migrations), the `early_activity_attempts` and `early_activity_progress` tables, and the hooks `useEarlyReward`, `useEarlyProgress`, `useEarlyRecommendations`, `useEarlyAchievements`.
- Migrations in the repo define `early_content_items`, `early_video_resources`, `early_achievements`, `early_user_achievements`. Whether they exist in production must be checked first (step 0).
- Store and profile: shared `StorePage`, `AvatarStore`, `avatar_items`, `user_inventory`, `user_currency` (wallet), and `UserProfilePage` (about 48 KB, not phone-optimised).
- Leaderboard: shared `Leaderboard.tsx` with season XP.
- Feedback components: `EarlyCelebration` and `EarlyEncouragement`. Both have lint errors and will be rewritten.

## Architecture

```text
src/features/early/
  content/        typed catalog: skills, games, questions, facts, videos, explore
  engine/         grade profile, difficulty, adaptive picker, anti-repeat
  games/          one module per mechanic; each reads a GameSpec
  quiz/  videos/  discover/  explore/  leaderboard/  store/  profile/
  feedback/       FeedbackOverlay, mascot, sounds, haptics
  data/           repository: DB first, bundled catalog as fallback
```

- **Grade profile** (`engine/gradeProfile.ts`): maps KG, 1, 2, 3, 4 to number ranges, word length, reading load, timer, hint count, choice count, and whether audio is narrated. All modules read from it, so nothing is hardcoded per grade.
- **Content model**: each item carries `skill`, `subject`, `gradeMin`/`gradeMax`, `difficulty` 1-5, `tags`. Games are mechanics plus generators: for example, Number Quest generates problems from the grade profile instead of storing lists.
- **Adaptive engine**: tracks per-skill mastery from `early_activity_progress`. Each round targets about 75% success, steps difficulty up or down, and skips items seen in the last N sessions.
- **Rewards**: still go through `complete_early_activity` only. Nothing is written from the browser.

## Database additions (SQL files for mytbjkchvfybhyqcynnl)

1. `early_content_items` (extended or verified): `kind` (question, fact, explore, game_level), `subject`, `skill`, `grade_min`/`grade_max`, `difficulty`, `payload` jsonb, `status`, `locale`.
2. `early_video_resources`: `youtube_id`, `title`, `channel`, `subject`, `topic`, `grade_min`/`grade_max`, `duration_s`, `status` (pending, approved, retired), `reviewed_by`, `reviewed_at`, `fallback_id`. Children can only read approved rows.
3. `early_item_exposure` (user_id, item_id, last_seen, times_seen, last_correct). Used for anti-repeat and discovery progress. RLS: own rows only.
4. `early_video_views` (user_id, video_id, seconds_watched, completed).
5. `early_collectibles` (catalog: rarity, set_name, price_coins, unlock_rule, `model` jsonb for the 3D card look) and `early_user_collection`. Purchases go through a new `purchase_early_item(p_item_id)` RPC that checks the wallet and inserts in one transaction.
6. `get_early_leaderboard(p_scope, p_period, p_category)`: a security-definer function that returns first name or username, avatar, level, and score only. It never returns full names, grade, school, or email. Scopes: my class, my grade band, friends.
7. `get_early_profile_summary(p_user_id)`: returns XP, level, streak, top collectibles, achievements, and discovery rank in one call.

Every new table gets GRANTs, RLS, and a matching `updated_at` trigger. Admins manage content through the existing `has_role` helper.

## Phases

**Phase 0: Safety and audit (first)**
- Run a read-only SQL check, provided as a file, that you run in production and paste back. It confirms which `early_*` tables and RPCs exist.
- Fix the `EarlyVideosPage` crash and the type and lint errors in early files.
- Build the `features/early` skeleton, grade profile, and repository with fallback.

**Phase 1: Feedback system and Quiz**
- Child-friendly feedback overlay: a bounce on correct answers, a gentle shake on wrong ones, then a "here's why" card with the right answer and a hint before moving on. Uses CSS keyframes, an optional sound, and supports reduced motion.
- Quiz hub with subjects (Math, Reading, Science, World, Logic), at least 40 questions per grade per subject in the seed, adaptive picks, anti-repeat, and a results screen.

**Phase 2: Games engine**
- Port the 10 existing games to GameSpec modules that scale with grade. For example, Number Quest goes from counting in KG to multiplication and division in Grade 4, and Word Builder goes from 3-letter words to multi-syllable words.
- New mechanics: Drag-to-Sort, Number Line Jump, Clock Reader, Money Market, Sentence Builder, Fraction Pizza (Grades 3-4), Map Explorer.
- Each game gets levels, hints, a speed setting, and a star rating.

**Phase 3: Videos**
- Videos play inside the app using the `youtube-nocookie.com` embed with `rel=0` and `modestbynetwork` set. The shelf is filtered by grade and topic from admin-approved rows only.
- Admin page to add a YouTube ID, which stays pending until reviewed. If a video is unavailable or the app is offline, it shows the fallback video or a "try another" card.
- The app will state that only reviewed videos are shown. It will not claim that YouTube content is guaranteed safe.

**Phase 4: Discover and Explore**
- Discover loop: a fact card, then a question, then feedback, then progress. A "Most Discovered" rank (Curious Cub, Explorer, Scholar, and up) comes from real exposure counts. Content is grade-filtered and does not repeat for the same user.
- Explore hub: our own catalog. Categories include Animals, Space, Human Body, Ethiopia and the World, Art, Music, How Things Work, and Maths Puzzles. Each resource is an interactive card set: swipe pages, tap to learn, mini-check, and save to favourites. No external redirects.

**Phase 5: Store, collection, profile**
- Early store with collectible sets (pets, badges, hats, stickers) bought with coins through the RPC, plus a collection book with set completion.
- 3D-style cards using CSS `perspective` and `transform` tilt, with no new 3D library.
- Compact phone-first profile: a header row with avatar, level ring, and XP; a stats strip (streak, stars, discovered); a horizontal carousel of collection highlights; an achievements grid; an edit-avatar sheet. It aims to fit in about 1.5 phone screens.

**Phase 6: Leaderboard**
- Early-only leaderboard: weekly, monthly, and all-time; categories (overall, math, reading, discover); scope (class, grade band, friends).
- Shows "your spot" with nearby players and progress badges, and celebrates personal bests.
- Shows only first name or username and avatar.

## Technical notes

- Grade 5+ code paths are untouched. Shared components (`Leaderboard`, `StorePage`, `UserProfilePage`) branch on `useTier() === "early"` at the top and render new Early components. Other tiers keep their current code.
- Seed content goes in versioned SQL plus a TypeScript mirror for offline fallback.
- Checks after each phase: type check on `tsconfig.app.json`, the production build, and Playwright screenshots at phone size (390px) and desktop. Signed-in screenshots need a test Early account.

## Open assumptions

- Grade 4 stays in the Early tier, as `getUserTier` already does.
- I will draft the seed questions, facts, and an initial list of about 30 YouTube video IDs. All of it is marked pending until you or an admin approve it.
