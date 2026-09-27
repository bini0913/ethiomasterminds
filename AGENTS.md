# Project architecture
- Keep age-tier mapping in `getUserTier` and expose it through `TierProvider` inside `UserProvider`, deriving from the loaded profile grade; this avoids duplicate user data and lets future screens branch without a second database request.
- Define shared theme roles in `src/index.css` and map them through Tailwind semantic colors; this keeps shared controls consistent in light and dark modes while individual screens are migrated in later phases.
