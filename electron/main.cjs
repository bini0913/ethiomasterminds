const { app, BrowserWindow, shell } = require('electron');

const PRODUCTION_URL = 'https://masterminds08.vercel.app/';

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Master Minds',
    backgroundColor: '#0A1526',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.setMenuBarVisibility(false);

  // Load the same production app used by the Android build so the
  // Windows app always has the current Master Minds UI and branding.
  win.loadURL(PRODUCTION_URL);

  // Keep external destinations out of the embedded app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      const production = new URL(PRODUCTION_URL);

      if (target.origin === production.origin) {
        return { action: 'allow' };
      }

      shell.openExternal(url);
      return { action: 'deny' };
    } catch {
      return { action: 'deny' };
    }
  });

  win.webContents.on('will-navigate', (event, url) => {
    try {
      const target = new URL(url);
      const production = new URL(PRODUCTION_URL);

      if (target.origin !== production.origin) {
        event.preventDefault();
        shell.openExternal(url);
      }
    } catch {
      event.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.biniam.masterminds');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
