# Master Minds: World-Class UX Standard

## Product promise

Master Minds should help a learner confidently answer three questions on every screen:
1. Where am I?
2. What can I do here?
3. What is the most useful next step?

Treat the product as one coherent learning system, not a collection of disconnected pages. Preserve the existing React/Vite application, Supabase project, authentication, data ownership, and working feature behavior while improving the experience in focused, reviewable changes.

## Experience principles

- **One design system, three age-appropriate expressions.** KG–Grade 4 is warm, playful, simple, and guided. Grades 5–8 are energetic and social without becoming cluttered. Grades 9–12 are focused, professional, information-dense only when useful, and centered on mastery and exam preparation.
- **Learning before decoration.** Use clear explanations, active recall, timely feedback, spaced review, and transparent progress. Do not optimize for streaks or time-on-screen at the expense of learning.
- **One primary action per screen.** Make the next useful step obvious; keep secondary actions discoverable without competing for attention.
- **Mobile first.** Design for narrow phones, touch, safe areas, keyboard visibility, tablets, and desktop. Avoid horizontal overflow, tiny controls, and layouts that depend on hover.
- **Trustworthy states.** Every data-driven screen should have deliberate loading, first-use/empty, success, failure, retry, and (where applicable) offline states. Never display invented progress or imply an action succeeded before the backend confirms it.
- **Accessible by default.** Semantic headings and landmarks, visible keyboard focus, readable contrast, labelled controls, reduced-motion support, clear validation, and touch targets aligned with WCAG 2.2 AA.
- **Protect existing behavior.** Do not create a replacement backend or project. Keep permissions enforced server-side, avoid exposing private student data, and do not change AI Tutor internals in unrelated work.

## Page review checklist

Review each route against these criteria before changing it:

1. **Purpose and hierarchy:** a clear page title, concise context, one primary action, and sensible grouping.
2. **Journey and navigation:** expected entry/exit paths, working back/home behavior, active navigation, and no dead ends.
3. **Visual system:** consistent spacing, typography, semantic colors, surfaces, borders, icon treatment, and responsive layouts.
4. **Interaction:** predictable controls, disabled/loading states, confirmation for destructive actions, useful feedback, and keyboard support.
5. **Real data:** correct user/grade scoping, accurate labels, no fabricated content or stats, and graceful handling of missing data.
6. **Learning quality:** where relevant, retrieval practice, explanatory feedback, spaced review, clear mastery signals, and learner control.
7. **Accessibility and privacy:** focus visibility, contrast, labels, reduced motion, safe social defaults, and role-appropriate access.
8. **Quality gates:** typecheck, lint/build where available, tests for important journeys, and regression checks for affected routes.

## Page inventory and implementation order

### Phase 1 — shared foundation
- src/index.css, src/App.tsx, src/components/layout/StudentBottomNav.tsx, shared headers and page shells.
- Resolve duplicate/competing navigation patterns, improve mobile safe areas and loading/error presentation, and standardize shared page primitives without forcing a redesign on every page at once.

### Phase 2 — learner entry and home
- Index.tsx, StudentDashboard.tsx, UserProfilePage.tsx, AvatarCreator.tsx, Settings.tsx, EnhancedSettings.tsx.
- Ensure login/profile setup, role redirects, grade-specific home screens, profile access, settings, and logout are easy to understand and reliable.

### Phase 3 — early learning
- EarlyCollectionPage.tsx, EarlyDiscoverPage.tsx, EarlyExplorePage.tsx, EarlyGamesPage.tsx, EarlyLeaderboardPage.tsx, EarlyProfilePage.tsx, EarlyProgressPage.tsx, EarlyQuizPage.tsx, EarlyVideosPage.tsx, EarlyContentAdminPage.tsx.
- Keep choices simple, feedback encouraging, text readable, interactions forgiving, and content appropriate to the learner's grade.

### Phase 4 — academic learning
- AcademicMode.tsx, AcademicSetup.tsx, ExamModePage.tsx, FlashcardsPage.tsx, LibraryPage.tsx, AcademicInsightsPage.tsx, StudyPlannerPage.tsx, TopicCoveragePage.tsx, TimeTravelRevision.tsx, LearningDNA.tsx.
- Build a connected loop from book/topic selection to learning, practice, feedback, spaced revision, and honest progress. Distinguish verified exam questions from generated practice.

### Phase 5 — social, play, and collaboration
- Friends.tsx, Chat.tsx, SocialHub.tsx, EnhancedSocial.tsx, Lobby.tsx, Multiplayer.tsx, Tournaments.tsx, StudyModePage.tsx, Quiz.tsx, QuizFilter.tsx, Leaderboard.tsx, StorePage.tsx, NotificationSettingsPage.tsx.
- Prioritize reliable state transitions, understandable invite/call actions, accessible controls, real-time feedback, and usable phone/tablet call layouts.

### Phase 6 — family, staff, and operations
- ParentDashboard.tsx, TeacherPortal.tsx, AdminPortal.tsx, FinancePortal.tsx, ManagerControlCenter.tsx, ManagerDashboard.tsx, SuperAdminPortal.tsx, ExtremeAdminPortal.tsx, SupabaseMigration.tsx, NotFound.tsx.
- Use role-specific navigation, clear data summaries, safe destructive actions, visible permission boundaries, and recovery guidance.

### Cross-cutting routes
- AITutor.tsx, Chat.tsx, EnhancedSocial.tsx, NotificationSettingsPage.tsx, Settings.tsx, and all shared components must be included in regression checks when shared infrastructure changes. AI Tutor should remain untouched unless a change is specifically approved for that feature.

## Quality scorecard

Score each page from 0–5 in each area and record evidence, not impressions:

| Area | Weight |
| --- | ---: |
| Task clarity and navigation | 20% |
| Interaction quality and feedback | 20% |
| Visual hierarchy and consistency | 15% |
| Responsive behavior | 15% |
| Accessibility | 15% |
| Loading, empty, and error states | 10% |
| Performance and maintainability | 5% |

A page is not considered complete merely because it looks polished. Its key user journey must work with real data, permissions, and error states.

## Research references

- [W3C Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/)
- [The science of effective learning with spacing and retrieval practice — Nature Reviews Psychology](https://doi.org/10.1038/s44159-022-00089-1)
- [Retrieval Practice Consistently Benefits Student Learning — Educational Psychology Review](https://doi.org/10.1007/s10648-021-09595-9)

## Pull request discipline

Ship small, coherent phases. Each PR must describe the affected routes, intended behavior, tests run, known limitations, and any manual verification still needed. Do not claim full end-to-end verification unless the actual authenticated journeys were tested.
