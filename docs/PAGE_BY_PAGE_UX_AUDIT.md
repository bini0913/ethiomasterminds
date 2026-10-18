# Master Minds page-by-page UX and reliability audit

## Purpose

Track a real route-by-route completion effort. This checklist is not a claim that every page has already passed review. A route is complete only after its key journey has been checked against real data, authorization, responsive behavior, accessibility, and failure states.

## Research standards

- Accessibility: WCAG 2.2 AA baseline: semantic headings and labels, visible keyboard focus, focus not obscured by sticky UI, predictable navigation, error messages in text, and appropriate touch-target sizing. https://www.w3.org/TR/WCAG22/
- Forms: label required fields, explain validation errors, accept reasonable input formats, and validate on the server too. https://www.w3.org/WAI/tutorials/forms/validation/
- Learning design: use retrieval practice with corrective feedback and spaced review when appropriate; do not treat engagement or time-on-screen as evidence of learning. https://www.nature.com/articles/s44159-022-00089-1 and https://doi.org/10.1007/s10648-021-09595-9
- Product safety: preserve role/tier boundaries, least-privilege access, student privacy, and appropriate social defaults for younger learners.
- Responsive UX: verify phone, tablet, and desktop layouts, touch operation, safe areas, and reduced-motion preferences.

## Definition of done for each route

- [ ] Purpose and primary action are clear.
- [ ] Direct URL entry, refresh, back, home, and active navigation work.
- [ ] Auth, role, grade/tier, and data ownership boundaries are correct.
- [ ] Loading, empty/first-use, success, failure/retry, and offline states are appropriate.
- [ ] Mutations show pending state and report success only after backend confirmation.
- [ ] Forms have labels, useful validation, keyboard support, and understandable errors.
- [ ] Layout works on phone, tablet, and desktop without unintended horizontal overflow.
- [ ] Keyboard focus is visible and not hidden behind sticky navigation.
- [ ] Reduced-motion preferences and touch targets are respected.
- [ ] Tests/build/lint are run where available; manual checks are recorded honestly.

## Route inventory and phase order

Statuses are not yet audited unless explicitly updated in a pull request.

### Phase 1 — Shared foundation and access
- [ ] Home, settings, enhanced settings, notifications, profiles, avatar creator.
- [ ] Route guards, loading states, role/tier boundaries, logout, browser/native back behavior, not-found and lazy-loading states.
- [ ] Shared navigation and responsive safe-area behavior.

### Phase 2 — Early learners (KG–Grade 4)
- [ ] Games, quick quiz, videos, discover, explore.
- [ ] Progress, ranks, collection, profile, store, and early content administration.
- [ ] Resolve the product-safe early Social/Friends experience before exposing general chat or unrestricted social routes. Do not bypass existing restrictions to make navigation appear functional.

### Phase 3 — Grades 5–8 and shared student journeys
- [ ] Quiz and quiz filters, lobby, multiplayer, tournaments, leaderboard.
- [ ] Social, community, friends, chat, and study mode.
- [ ] Library, revision, Learning DNA, profile, settings, notifications, rewards.
- [ ] AI Tutor is regression-only unless specifically approved.

### Phase 4 — High-school academic preparation (Grades 9–12)
- [ ] Academic home and setup, flashcards, topic coverage, exam mode, planner, insights.
- [ ] Library, revision, and Learning DNA.
- [ ] Verify analyzed book/topic data is reused consistently; distinguish verified exam questions from generated practice. Never label generated questions as real past-paper questions.

### Phase 5 — Family, staff, and operations
- [ ] Parent dashboard, teacher portal, admin portal, early content admin.
- [ ] Manager portal and dashboard, finance, super admin, owner control portal, Supabase migration.
- [ ] Verify privileged routes against the actual role model and server-side permissions, not route visibility alone.

### Phase 6 — Cross-device and release validation
- [ ] Test key journeys at phone, tablet, and desktop sizes.
- [ ] Check notifications and study calls on supported browser/mobile contexts.
- [ ] Run typecheck, lint, production build, and relevant automated tests.
- [ ] Confirm Android APK and Windows EXE workflow outcomes after changes are merged; a started workflow is not proof of success.
- [ ] Smoke-test production: https://masterminds08.vercel.app/

## First code-review finding

- The early-tier route guards previously returned null while auth/profile state was loading, producing a blank screen with no explanation.
- The restricted-route guard allowed a student with an unresolved/unknown tier through because it only blocked the early tier. The first hardening change adds a visible loading state and prevents unassigned student profiles from bypassing the tier restriction.
- This does not yet implement an early-tier social destination. That needs an age-appropriate product flow rather than routing younger learners into unrestricted chat/community pages.
