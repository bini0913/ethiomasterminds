# Building MasterMinds.exe (Windows)

This source zip is preconfigured with Electron. To produce the Windows .exe on your own machine:

## Prerequisites
- Node.js 20+ installed (https://nodejs.org)
- Windows, macOS, or Linux (cross-compile works from any OS)

## Steps
```bash
# 1. Extract this zip and open a terminal in the folder
npm install
npm install --save-dev electron@31 @electron/packager@18

# 2. Build the web app
# Windows PowerShell:
$env:ELECTRON_BUILD=1; npx vite build
# macOS/Linux:
ELECTRON_BUILD=1 npx vite build

# 3. Package as Windows .exe
npx @electron/packager . MasterMinds --platform=win32 --arch=x64 --out=release --overwrite --ignore="^/src$" --ignore="^/public$" --ignore="^/supabase$" --ignore="^/scripts$" --ignore="^/release"
```

The .exe will be at: `release/MasterMinds-win32-x64/MasterMinds.exe`

Double-click MasterMinds.exe to run. The app connects to your live Lovable Cloud backend (internet required).

## Database
`master-minds-database.sql` is the full Postgres dump (schema + data) of your Lovable Cloud database — keep as backup or use to self-host.
