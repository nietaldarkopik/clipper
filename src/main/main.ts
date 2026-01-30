import { app, BrowserWindow } from 'electron';
import path from 'path';
import { startServer } from '../backend/server';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    backgroundColor: '#0f0f0f',
    titleBarStyle: 'hidden', // Matches the custom header in design
    titleBarOverlay: {
      color: '#141414',
      symbolColor: '#ffffff'
    }
  });

  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  if (app.isPackaged) {
    await startServer();
  } else {
    console.log('Dev mode: Backend should be running separately on port 3000');
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
