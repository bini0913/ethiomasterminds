# Phase 1 design-system audit

Audit performed before migration with `rg` across `src/**/*.{ts,tsx,css}` for Tailwind colour families, arbitrary values, CSS colour functions and gradient utilities. This document is an intentional decision record, not a claim that all content artwork is tokenized.

## Classification and disposition

| Category | Locations / examples | Decision |
| --- | --- | --- |
| **A — should use semantic token** | Shared primitives in `components/ui` (overlays, cards, controls, alerts, badges); compatibility utilities in `index.css` | Migrated shared chrome to `surface`, `card`, `border`, status, focus and new `overlay` semantic roles. |
| **B — intentional tier personality** | `tier-early`, `tier-middle`, `tier-upper` token overrides; tier home/welcome decoration | Preserved. These values are the existing tier personality layer behind shared roles, not page-specific UI chrome. |
| **C — intentional status color** | Quiz correctness, connection indicators, destructive actions, achievement status | Preserve where the colour communicates state; shared `Badge` and `Alert` now expose semantic status variants. |
| **D — data visualization / subject color** | Charts, subject/quiz category metadata, competition/rank data | Preserve: data series need stable distinctions independent of the active app theme. Chart selectors map surrounding chrome to tokens. |
| **E — decorative / legacy** | `glass`, glow and futuristic aliases; generic gradient button/card treatments in avatar editors | Legacy utility implementations are already semantic/no-motion compatibility aliases. Generic avatar-editor primary gradients remain a focused cosmetic-editor treatment; later feature migration should replace their CTA use with the shared Button variant. |
| **F — should not change** | Avatar skin/hair/eye/clothing palettes, SVG illustration strokes/fills, avatar background gradients, achievement rarity art | Preserved as user-created content/artwork. Replacing these with UI tokens would reduce avatar customization and reward meaning. |

## Legacy utility usage

The following utility names still have consumers: `glass`, `glass-light`, `neon-border`, `glow-*`, `animated-gradient`, `float`, `pulse-glow`, `light-streak`, `shimmer`, `rotating-border`, `btn-futuristic`, `text-glow`, `xp-bar`, and `card-hover`. Their global implementations deliberately resolve to semantic surface/border/shadow roles and suppress legacy visual effects; they remain only as compatibility aliases while feature pages migrate. The global reduced-motion rule also neutralizes animation.

## Gradient disposition

Gradients in avatar appearance choices, rewards, avatar illustrations, and tier/welcome artwork are intentional content/decorative treatments (B/E/F). Gradients in third-party Radix animation class names are transitions, not painted gradients. New and migrated shared components do not use gradients for generic cards, buttons, forms, dialogs, sheets, badges, or states.

## Remaining follow-up

Feature pages still contain substantial historical utility colour usage. They are documented as B–F above or need page-level Phase 2 migration; changing them en masse here would redesign tier homes, quizzes, and feature workflows outside this phase. Shared primitives now provide the semantic replacement path.
