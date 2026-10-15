const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  desktopCapturer,
  systemPreferences,
} = require('electron');
const path = require('path');
const AutoLaunch = require('auto-launch');
const { ulid } = require('ulid');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '.env');
dotenv.config({ path: envPath });

// Only ask for media access on macOS
if (process.platform === 'darwin') {
  systemPreferences.askForMediaAccess('microphone');
  systemPreferences.askForMediaAccess('camera');
}

const AWS = require('aws-sdk');
const IS_WINDOW_MODE = process.env.MODE === 'WINDOW';

console.log('IS_WINDOW_MODE', IS_WINDOW_MODE);

let tray = null;
let window = null;
let mainWindow = null;

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
  return;
}

// Initialize AutoLaunch
const clipShareAutoLauncher = new AutoLaunch({
  name: 'ClipShare',
  path: app.getPath('exe'),
});

const s3 = new AWS.S3({
  accessKeyId: process.env.ACCESS_KEY,
  secretAccessKey: process.env.ACCESS_SECRET,
  endpoint: process.env.ENDPOINT,
  signatureVersion: 'v4',
  region: process.env.REGION,
});

const BUCKET_NAME = process.env.BUCKET_NAME;
const ACL = process.env.ACL || 'public-read';
const PRESIGN_URL = String(process.env.PRESIGN_URL).toLowerCase() === 'true';
const PRESIGN_URL_EXPIRY =
  parseInt(process.env.PRESIGN_URL_EXPIRY, 10) || 86400;

// Enable AutoLaunch
clipShareAutoLauncher
  .isEnabled()
  .then((isEnabled) => {
    if (!isEnabled) clipShareAutoLauncher.enable();
  })
  .catch((err) => {
    console.error('AutoLaunch enable error:', err);
  });

function createWindow() {
  if (window) {
    if (window.isMinimized()) window.restore();
    window.focus();
    return;
  }

  window = new BrowserWindow({
    width: 325,
    height: 480,
    show: IS_WINDOW_MODE,
    frame: IS_WINDOW_MODE,
    resizable: IS_WINDOW_MODE,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false,
      // Keep area-recording frames flowing while the tray window is hidden
      backgroundThrottling: false,
    },
  });

  window.loadFile('index.html');

  // Let the renderer refresh the source list whenever the window is opened
  window.on('focus', () => window.webContents.send('window-focused'));

  if (IS_WINDOW_MODE) {
    window.on('close', (event) => {
      if (!app.isQuitting) {
        event.preventDefault();
        window.hide();
      }
      return false;
    });
  }

  // Request camera permissions
  window.webContents.session.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      if (permission === 'media') {
        callback(true);
      } else {
        callback(false);
      }
    }
  );

  // Enable DevTools for debugging
  // window.webContents.openDevTools({ mode: 'detach' });
}

function handleTrayClick(event, bounds) {
  if (!window) return;

  const { x, y } = bounds;
  const { height, width } = window.getBounds();

  const yPosition = process.platform === 'darwin' ? y : y - height;
  window.setBounds({
    x: x - width / 2,
    y: yPosition,
    height,
    width,
  });

  if (window.isVisible()) {
    console.log('Tray clicked: Hiding window');
    window.hide();
  } else {
    console.log('Tray clicked: Showing window');
    window.show();
    window.focus();
  }
}

function createTray() {
  if (IS_WINDOW_MODE) return;

  if (tray) {
    console.log('Tray already exists, destroying old tray');
    tray.destroy();
  }

  console.log('Creating new tray');
  tray = new Tray(path.join(__dirname, 'icon-idle.png'));
  tray.setToolTip('ClipShare');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.on('right-click', () => {
    tray.popUpContextMenu(contextMenu);
  });

  tray.on('click', handleTrayClick);
}

app.on('ready', () => {
  console.log('App is ready');
  createWindow();
  if (!IS_WINDOW_MODE) {
    createTray();
  }

  // Check for required environment variables
  if (!BUCKET_NAME || !process.env.ACCESS_KEY || !process.env.ACCESS_SECRET) {
    window.webContents.send('config-error');
    console.error(
      'Configuration error: BUCKET_NAME, ACCESS_KEY, or ACCESS_SECRET is not defined.'
    );
  }

  // Periodic cleanup every 6 hours
  // setInterval(cleanupAndRecreate, 6 * 60 * 60 * 1000);
});

function cleanupAndRecreate() {
  console.log('Performing periodic cleanup and recreation');
  if (tray) {
    tray.destroy();
  }
  createTray();
}

ipcMain.handle('start-recording', (event) => {
  if (!IS_WINDOW_MODE) {
    setTrayIconRecording(true);
  }
  console.log('Recording started');
});

ipcMain.handle('stop-recording', (event) => {
  if (!IS_WINDOW_MODE) {
    setTrayIconRecording(false);
  }
  console.log('Recording stopped, tray icon updated to idle state.');
});

function setTrayIconRecording(isRecording) {
  const iconPath = isRecording ? 'icon-recording.png' : 'icon-idle.png';
  tray.setImage(path.join(__dirname, iconPath));
}

let cameraWindow = null;
let cameraStream = null;

function createCameraWindow() {
  cameraWindow = new BrowserWindow({
    width: 200,
    height: 150,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false,
      permissions: ['camera', 'microphone'],
    },
  });

  // Stay above everything, including full-screen apps and other spaces
  cameraWindow.setAlwaysOnTop(true, 'screen-saver');
  cameraWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  cameraWindow.loadFile('camera.html');

  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  cameraWindow.setPosition(20, height - 170);
  cameraWindow.on('move', sendCameraBounds);
  cameraWindow.on('moved', sendCameraBounds);
  cameraWindow.on('closed', () => {
    cameraWindow = null;
    sendCameraBounds();
  });
  sendCameraBounds();
}

// macOS screen capture leaves out this app's own windows, so the recorder
// draws the camera into the video itself at the bubble's on-screen position.
function sendCameraBounds() {
  if (!window || window.isDestroyed()) return;
  if (!cameraWindow || cameraWindow.isDestroyed()) {
    window.webContents.send('camera-bounds', null);
    return;
  }
  const { screen } = require('electron');
  const bounds = cameraWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  window.webContents.send('camera-bounds', {
    bounds,
    display: { bounds: display.bounds, scaleFactor: display.scaleFactor },
  });
}

ipcMain.handle('get-display', (event, displayId) => {
  const { screen } = require('electron');
  const display =
    screen.getAllDisplays().find((d) => String(d.id) === String(displayId)) ||
    screen.getPrimaryDisplay();
  return { bounds: display.bounds, scaleFactor: display.scaleFactor };
});

ipcMain.handle('toggle-camera', async (event, enableCamera) => {
  console.log('Toggle camera called:', enableCamera);
  if (enableCamera) {
    if (!cameraWindow) {
      createCameraWindow();
    } else {
      console.log('Camera window already exists');
      cameraWindow.show();
    }
  } else {
    if (cameraWindow) {
      console.log('Closing camera window');
      cameraWindow.close();
      cameraWindow = null;
      sendCameraBounds();
    }
  }
});

ipcMain.handle('get-camera-stream', async () => {
  if (cameraStream) {
    return cameraStream.id;
  }
  return null;
});

ipcMain.handle('set-camera-stream', (event, streamId) => {
  cameraStream = { id: streamId };
});

ipcMain.handle('release-camera-stream', () => {
  if (cameraStream) {
    cameraStream = null;
  }
});

ipcMain.handle('get-sources', async (event) => {
  console.log('Received get-sources request');
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 0, height: 0 },
    });
    // Don't offer ClipShare's own windows as recording targets
    const ownIds = BrowserWindow.getAllWindows().map((w) =>
      w.getMediaSourceId()
    );
    return sources
      .filter((source) => !ownIds.includes(source.id))
      .map(({ id, name, display_id }) => ({ id, name, display_id }));
  } catch (error) {
    console.error('Error getting sources:', error);
    throw error;
  }
});

let areaWindow = null;
let resolveArea = null;

function finishAreaSelection(result) {
  if (resolveArea) resolveArea(result);
  resolveArea = null;
  if (areaWindow) {
    const win = areaWindow;
    areaWindow = null;
    win.close();
  }
}

// Opens a transparent overlay over the given display and resolves with the
// dragged rectangle (in display-relative DIPs), or null if cancelled.
ipcMain.handle('select-area', (event, displayId) => {
  const { screen } = require('electron');
  const display =
    screen.getAllDisplays().find((d) => String(d.id) === String(displayId)) ||
    screen.getPrimaryDisplay();

  finishAreaSelection(null);

  areaWindow = new BrowserWindow({
    ...display.bounds,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    skipTaskbar: true,
    enableLargerThanScreen: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  areaWindow.setAlwaysOnTop(true, 'screen-saver');
  areaWindow.setBounds(display.bounds);
  areaWindow.loadFile('area.html');
  const win = areaWindow;
  win.on('closed', () => {
    if (areaWindow === win) finishAreaSelection(null);
  });

  return new Promise((resolve) => {
    resolveArea = (rect) =>
      resolve(
        rect && {
          rect,
          display: {
            width: display.bounds.width,
            height: display.bounds.height,
            scaleFactor: display.scaleFactor,
          },
        }
      );
  });
});

ipcMain.on('area-selected', (event, rect) => {
  if (!areaWindow || event.sender !== areaWindow.webContents) return;
  if (rect) {
    // The OS may nudge the overlay (e.g. below the macOS menu bar), so
    // translate from overlay coordinates to display coordinates.
    const { screen } = require('electron');
    const content = areaWindow.getContentBounds();
    const display = screen.getDisplayMatching(content);
    rect = {
      ...rect,
      x: rect.x + content.x - display.bounds.x,
      y: rect.y + content.y - display.bounds.y,
    };
  }
  finishAreaSelection(rect);
});

ipcMain.on('save-recording', async (event, buffer, format = {}) => {
  const { extension = 'webm', contentType = 'video/webm' } = format;
  const fileName = `${ulid()}.${extension}`;
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ACL: ACL,
      ContentType: contentType,
    };

    const result = await s3.upload(params).promise();
    let url;
    if (PRESIGN_URL) {
      url = s3.getSignedUrl('getObject', {
        Bucket: BUCKET_NAME,
        Key: fileName,
        Expires: PRESIGN_URL_EXPIRY,
      });
    } else if (process.env.URL_PREFIX) {
      const prefix = process.env.URL_PREFIX.endsWith('/')
        ? process.env.URL_PREFIX
        : `${process.env.URL_PREFIX}/`;
      url = `${prefix}${fileName}`;
    } else {
      url = result.Location;
    }

    require('electron').shell.openExternal(url);
    event.reply('recording-saved', url);
  } catch (error) {
    console.error('Failed to upload video:', error);
    event.reply('recording-error', error.message);
  }
});

// New IPC handler for checking camera permission
ipcMain.handle('check-camera-permission', async () => {
  console.log('Checking camera permission');
  if (process.platform !== 'darwin') {
    // On Windows and Linux, we can't check permissions this way
    console.log('Camera permission check not supported on this platform');
    return 'unknown';
  }

  try {
    const status = systemPreferences.getMediaAccessStatus('camera');
    console.log('Camera permission status:', status);
    return status;
  } catch (error) {
    console.error('Error checking camera permission:', error);
    return 'error';
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else if (IS_WINDOW_MODE) {
    window.show();
  }
});

app.on('before-quit', (event) => {
  console.log('App is about to quit.');
  // Optionally, cancel the quit process if needed
  // event.preventDefault();

  // Close all windows or perform any other cleanup
  if (window) {
    window.close();
  }
  if (cameraWindow) {
    cameraWindow.close();
  }
  app.isQuitting = true;
});

// New IPC handler for quitting the app when .env variable is not set
ipcMain.on('quit-app', () => {
  console.log('Quit app request received');
  app.quit();
});
