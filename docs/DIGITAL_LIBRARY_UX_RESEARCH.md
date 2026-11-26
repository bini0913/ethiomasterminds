# Digital Library UX Research

## Research-backed direction

The redesign should make the library a focused reading workspace rather than a single screen that exposes every feature at once.

- Use a clear primary journey: discover a resource, resume reading, or open a saved item.
- Separate destinations from actions. Navigation should contain the most frequent destinations, while upload, moderation, download, edit, and delete belong in contextual actions.
- Keep cards scannable. A card should represent one resource with a clear hierarchy: cover, title, subject/grade, short supporting text, one primary action, and secondary actions in an overflow menu.
- Treat the reader as a calm full-screen mode. Table of contents, bookmarks, notes, highlights, and AI study tools should be persistent but contextual, with a side panel on desktop and a sheet on mobile.
- Make location visible. Reader progress, current page/section, and saved reading position should be easy to understand.
- Build for keyboard and touch from the start: visible focus, labeled controls, predictable Escape behavior, adequate targets, no focus traps, and responsive reflow.

## Applied product decisions

1. Library home: Continue reading, recommendations, search, filters, and compact stats.
2. Personal shelf: Saved, downloaded, assigned, notes, and highlights are grouped as personal study destinations.
3. Resource cards: one prominent Read button; bookmark is an icon button; management actions are hidden in an overflow menu.
4. Reader: PDF occupies the main stage; AI and annotation tools are optional panels, not permanent visual competition.
5. Mobile: the navigation rail becomes a horizontal section switcher; reader tools become a bottom sheet/panel instead of a second desktop column.
6. Truthful states: use real counts and reading progress only; preserve loading, empty, error, and retry messaging.

## Sources

- [1] [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — keyboard operation, focus, reflow, target size, and accessible names.
- [2] [Material Design 3 navigation drawer](https://m3.material.io/components/navigation-drawer) — responsive navigation variants and grouping frequent destinations first.
- [3] [Material Design 3 cards](https://m3.material.io/components/cards/guidelines) — hierarchy, one-topic cards, collection filtering outside cards, and overflow actions.
- [4] [Interactive TOCs, Bookmarks, and Notes: UX Patterns Readers Actually Use](https://www.3dissue.com/interactive-tocs-bookmarks-and-notes-ux-patterns-readers-actually-use/) — reader orientation, clickable navigation, persistent bookmarks, and contextual annotations.
