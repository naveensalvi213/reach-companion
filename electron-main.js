const { app, BrowserWindow, Notification } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: "Reach Companion",
    autoHideMenuBar: true,
    backgroundColor: '#0F172A', // Match design system dark theme
  });

  // Load the compiled static index.html file
  mainWindow.loadFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Global notification trigger for same-process backend
global.triggerNotification = (title, body, postId, platform) => {
  if (postId && process.platform === 'win32') {
    const { execFile } = require('child_process');
    const helperPath = path.join(__dirname, 'toast-helper.ps1');
    const args = [
      '-ExecutionPolicy', 'Bypass',
      '-File', helperPath,
      '-title', title,
      '-body', body,
      '-postId', postId,
      '-platform', platform
    ];
    execFile('powershell.exe', args, (err) => {
      if (err) {
        console.error("Failed to display interactive Toast:", err);
        showFallbackNotification(title, body, postId);
      }
    });
  } else {
    showFallbackNotification(title, body, postId);
  }
};

function showFallbackNotification(title, body, postId) {
  const notification = new Notification({
    title: title,
    body: body,
    silent: false,
  });

  notification.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (postId) {
        mainWindow.webContents.executeJavaScript(`window.handleNotificationClick && window.handleNotificationClick("${postId}")`).catch(err => console.error(err));
      }
    }
  });

  notification.show();
}

function startBackend() {
  // Start backend directly inside the Electron main process
  require('./backend/index.js');
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
