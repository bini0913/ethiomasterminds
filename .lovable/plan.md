## Goal

Produce a single downloadable zip containing **everything** needed to run Master Minds locally on your machine — full source code, Electron desktop wrapper, database schema + data, environment config, and step-by-step instructions.

## What the zip will contain

```
master-minds-local/
├── src/                          # Full React app source
├── public/                       # Static assets, PWA icons
├── electron/main.cjs             # Desktop wrapper
├── supabase/
│   ├── functions/                # All 12 edge functions (AI Tutor, etc.)
│   ├── migrations/               # Full schema history
│   └── config.toml
├── database/
│   ├── schema.sql                # Tables, RLS, functions, triggers
│   └── data.sql                  # Current row data (profiles, quizzes, etc.)
├── .github/workflows/
│   └── build-windows.yml         # Auto-build .exe on push
├── .env.example                  # Template for backend keys
├── package.json, vite.config.ts, tailwind.config.ts, tsconfig*.json
├── index.html, components.json, postcss.config.js
├── README_LOCAL.md               # Run locally (web + desktop)
├── BUILD_EXE.md                  # Build Windows .exe in 3 commands
└── GET_YOUR_EXE.md               # GitHub Actions auto-build path
```

## Steps

1. **Dump the live database** (schema + data) from Lovable Cloud into `database/schema.sql` and `database/data.sql` using the Supabase tools.
2. **Write `.env.example`** with the Supabase URL + publishable key already filled in (these are public/safe), so the app connects immediately on first run.
3. **Write `README_LOCAL.md`** with three run modes:
   - **Web local**: `npm install && npm run dev` → opens at `localhost:8080`
   - **Desktop local**: `npm install && npm run build && npx electron .` → opens MasterMinds in a desktop window
   - **Build .exe**: `npm install && npm run build && npx @electron/packager . MasterMinds --platform=win32 --arch=x64`
4. **Verify Electron config** (`electron/main.cjs`, `vite.config.ts` `base: './'`, `"main"` field in `package.json`) is intact from previous work.
5. **Bundle everything** into `/mnt/documents/master-minds-local-full.zip` excluding `node_modules`, `dist`, `.git`.

## Honest scope notes (please read)

- **The app needs internet** to reach Lovable Cloud (database, auth, AI Tutor, multiplayer). Running locally means the *code* runs on your machine, not the backend. This is true for any app built on a managed backend — the alternative is a multi-week rewrite to embed Postgres + auth + edge functions locally.
- **Windows `.exe` cannot be built inside Lovable's sandbox** (Electron's Windows binary download exceeds the 600s timeout). The zip includes two ways to get the `.exe`:
  - Run 3 commands locally on Windows (~2 min) — instructions in `BUILD_EXE.md`
  - Push to GitHub → the included workflow auto-builds `MasterMinds.exe` and posts it as a release (~5 min) — instructions in `GET_YOUR_EXE.md`
- **Data dump caveat**: I'll dump public tables. `auth.users` (login records) cannot be exported — users would need to re-sign-up against the same backend, OR you keep using the live Lovable Cloud backend (recommended, and what the included `.env.example` does).

## Deliverable

One file: `master-minds-local-full.zip` — preview/download from the chat after the build completes.