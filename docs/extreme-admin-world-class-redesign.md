# Extreme Admin — world-class command center sketch

## Intent

This redesign turns `/root-control-portal-9xA7` into an executive operations workspace without changing the protected data boundary. The page remains a control surface over existing RPCs, confirmations, audit behavior, and truthful loading/empty/error states.

## Sketch 01 — Overview / platform pulse

The default landing view is a calm, high-signal overview: six live scale cards, an attention queue, control-assurance snapshot, and three quick routes. Cards use real dashboard, report, deletion, and security values only. Quick routes change the existing tab state; they do not bypass a workflow or confirmation.

## Sketch 02 — Identity and access

Users remains the authority workspace: searchable account list, role/status controls, and explicit mutation confirmations. Super Admin and Schools are adjacent operational sections so elevated access and network scope are easy to review without mixing their authority models.

## Sketch 03 — Trust and safety

Reports and deletion requests are presented as explicit queues. Pending, in-review, completed, and rejected states stay visible. Destructive actions retain the existing confirmation and preflight behavior; no request is treated as complete merely because it is displayed.

## Sketch 04 — Platform operations

Finance, Economy, Content, Chats, System, and Audit Logs remain reachable from the shared shell. Their existing loaders, RPC payloads, settings controls, moderation context, and audit writes remain the behavior owners. Visual improvements should prioritize hierarchy, scannability, empty states, and touch-safe controls.

## Sketch 05 — Adaptive behavior

Desktop uses the shared deep-navy rail and contextual header. Tablet and phone use the shell drawer with a horizontally safe content canvas, stacked cards, and full-width action targets. Tab navigation is scroll-safe; operational buttons keep visible focus and at least touch-friendly sizing. No new permission or data-fetching path is introduced by responsive presentation.

## Acceptance checks

- Existing route guard, UserContext, RPC/function names and payloads, RLS, confirmations, and audit behavior remain unchanged.
- Overview is data-backed only and does not claim uptime, incidents, or health records that are not returned by the backend.
- Loading, error, empty, denied, and no-open-items states remain truthful.
- Validate with typecheck, lint, production build, route checks, and `git diff --check`.
