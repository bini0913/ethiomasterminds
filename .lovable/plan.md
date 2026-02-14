

# Fix Master Minds Backend Integration

## Current Status

Your project IS connected to Lovable Cloud. Here is what is working and what is broken:

**Working:**
- 48 database tables exist with RLS enabled on all of them
- 18 registered users in the database
- Authentication (signup/login) is functional
- 24 database functions (RPCs) are in place
- 3 storage buckets configured (avatars, quiz-assets, social-images)
- 16 tables have realtime enabled
- Seed data exists: 15 achievements, 8 daily missions, 20 avatar items

**Broken - needs fixing:**

---

## Issues Found and Fix Plan

### 1. CRITICAL: Chat System - Infinite Recursion in RLS Policies

**Problem:** The `chat_group_members` table has a SELECT policy called "Members can view group members" that references itself, causing an infinite recursion error:
```
cgm.group_id = cgm.group_id  (compares column to itself - always true!)
```
Similarly, the `chat_groups` SELECT policy references `chat_group_members` which in turn tries to read `chat_group_members` again.

**Fix:** Drop the broken policies and recreate them properly:
- `chat_group_members` SELECT: allow if `user_id = auth.uid()` OR user is a member of the same group (using a non-recursive check via `chat_groups.created_by`)
- `chat_groups` SELECT: fix the self-referencing join condition

---

### 2. CRITICAL: Profiles Not Visible to Other Users

**Problem:** The `profiles` table SELECT policies only allow users to see their own profile (or admin/teacher views). This means:
- Leaderboard cannot show other users' names
- Social feed shows "Unknown" for other users
- Friends list shows "Unknown"
- Chat shows "Unknown" for sender names

**Fix:** Add a public SELECT policy on profiles for basic fields, or a permissive policy allowing all authenticated users to read profiles. Since profiles contain no sensitive data (no emails, no passwords), this is safe.

---

### 3. Quiz System - No Quiz Content

**Problem:** Only 1 quiz exists with 11 questions, and it may not be approved. Students have no content to play.

**Fix:** Seed the database with sample quizzes across multiple subjects (Math, Science, English, History) with proper questions, and mark them as approved.

---

### 4. Quiz Results Not Saved to Database

**Problem:** The `QuizView` component calls `addXP` locally but never saves quiz results to the `quiz_results` table. This means:
- No quiz history
- Analytics show nothing
- Achievements based on quiz count never trigger

**Fix:** After quiz completion, insert a record into `quiz_results` with score, correct answers, total questions, and XP earned.

---

### 5. Manager/Admin Dashboard - User Role Updates May Fail

**Problem:** The `user_roles` table has restrictive RLS policies that only allow admin/manager to modify roles. However, the `handleUpdateUserRole` function in AdminPortal does a direct UPDATE which may fail because the RLS check uses `has_role()` which itself queries `user_roles` (potential recursion). The Manager Dashboard uses the `assign-role` edge function which is more reliable.

**Fix:** Standardize both Admin and Manager dashboards to use the `assign-role` edge function (which runs with service role key, bypassing RLS).

---

### 6. Realtime Missing for Key Tables

**Problem:** Some important tables are NOT in the realtime publication:
- `quizzes` (already handled via QuizContext channel - but table not in publication)
- `user_achievements`
- `user_currency`
- `tournaments`
- `tournament_participants`

**Fix:** Add missing tables to the `supabase_realtime` publication.

---

### 7. Leaked Password Protection Disabled

**Problem:** Security linter warns that leaked password protection is not enabled.

**Fix:** This requires enabling it via the backend settings. Will note this as a recommendation.

---

## Implementation Steps

### Step 1: Database Migration - Fix RLS Policies
- Drop and recreate `chat_group_members` SELECT policies (fix infinite recursion)
- Drop and recreate `chat_groups` SELECT policy (fix self-join bug)  
- Add authenticated users can read all profiles policy
- Add missing tables to realtime publication

### Step 2: Seed Quiz Data
- Insert 4-6 quizzes across different subjects (Math, Science, English, History)
- Insert 10+ questions per quiz with proper options and correct answers
- Mark all seeded quizzes as approved

### Step 3: Fix Quiz Results Saving
- Update `QuizView.tsx` to save results to `quiz_results` table after completion
- Also insert individual `question_attempts` for detailed analytics
- Call `update_analytics` RPC and `update_user_streak` RPC after quiz completion
- Call `check_achievements` RPC to trigger achievement unlocks

### Step 4: Fix Admin Portal Role Updates
- Change `handleUpdateUserRole` in `AdminPortal.tsx` to use the `assign-role` edge function instead of direct table update

### Step 5: Fix Social/Friends "Unknown" Names
- The profiles visibility fix in Step 1 will resolve this automatically
- Verify that `EnhancedSocialFeed`, `FriendsContext`, and `ChatContext` correctly join with profiles

---

## Technical Details

### RLS Policy Fixes (SQL)
```sql
-- Fix chat_group_members: drop broken policies, create working ones
DROP POLICY IF EXISTS "Members can view group members" ON chat_group_members;
DROP POLICY IF EXISTS "Users can view group members" ON chat_group_members;

CREATE POLICY "Users can view group members" ON chat_group_members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR group_id IN (
    SELECT cgm.group_id FROM chat_group_members cgm WHERE cgm.user_id = auth.uid()
  )
);

-- Fix chat_groups: drop broken policy
DROP POLICY IF EXISTS "Users can view groups they belong to" ON chat_groups;

CREATE POLICY "Users can view groups they belong to" ON chat_groups
FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR id IN (
    SELECT cgm.group_id FROM chat_group_members cgm WHERE cgm.user_id = auth.uid()
  )
);

-- Allow all authenticated users to read profiles
CREATE POLICY "Authenticated users can view all profiles"
ON profiles FOR SELECT TO authenticated
USING (true);
```

### Quiz Results Saving (TypeScript)
In `QuizView.tsx`, after quiz completion, call:
```typescript
await supabase.from('quiz_results').insert({
  quiz_id: quiz.id,
  student_id: user.id,
  score: finalScore,
  total_questions: quiz.questions.length,
  correct_answers: answeredCorrectly,
  time_taken: totalTimeTaken,
  xp_earned: totalXP,
  answers: userAnswers
});

await supabase.rpc('update_user_streak', { p_user_id: user.id });
await supabase.rpc('check_achievements', { p_user_id: user.id });
```

### Files to Modify
- `src/components/quiz/QuizView.tsx` - Save results to database
- `src/pages/AdminPortal.tsx` - Use edge function for role changes
- Database migration for RLS fixes, quiz seed data, and realtime publication updates

