# Get Your MasterMinds.exe — 3 Simple Steps

You don't need to install anything on your computer. GitHub will build the `.exe` for you, for free, automatically.

## Step 1 — Push this project to GitHub

In Lovable, click the **GitHub** button (top-right) → **Connect to GitHub** → create a new repository. Lovable pushes the code for you.

## Step 2 — Wait ~5 minutes

The moment the code lands on GitHub, the build workflow (`.github/workflows/build-windows.yml`) starts automatically. Go to your repo → **Actions** tab → watch the green checkmark appear.

## Step 3 — Download MasterMinds.exe

Two places to grab it:

- **Actions tab** → click the latest run → scroll to **Artifacts** → download `MasterMinds-Windows.zip`
- **Releases** (right sidebar of the repo) → latest release → download `MasterMinds-Windows.zip`

Unzip → double-click `MasterMinds.exe`. Done.

---

## Why this way?

Lovable's sandbox has a 10-minute command limit. Electron's Windows binary takes longer than that to download and bundle, so the `.exe` cannot be produced here. GitHub's Windows build runners have no such limit and bundle it correctly every time.

## What you get

- A real native Windows window titled "Master Minds"
- Loads your full app — every page, every feature
- Connects to your live Lovable Cloud backend (database, AI, leaderboard, multiplayer all work)
- Custom icon, proper window controls, no browser UI

## Requires internet

The desktop app talks to your Lovable Cloud backend. Truly offline operation would require rewriting the backend to run locally — that's a separate, much larger project.

## Need to rebuild?

Every push to `main` rebuilds automatically. Or trigger manually: Actions tab → **Build Windows EXE** → **Run workflow**.
