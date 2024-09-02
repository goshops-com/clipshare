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

let tray = null;
let window = null;
// Add this function to check if we're running on GNOME
function isGNOME() {
  return (
    process.platform === 'linux' &&
    process.env.XDG_CURRENT_DESKTOP &&
    process.env.XDG_CURRENT_DESKTOP.includes('GNOME')
  );
}

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
  window = new BrowserWindow({
    width: 325,
    height: 330,
    show: false,
    frame: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false,
    },
  });

  window.loadFile('index.html');

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

const AppIndicator = require('electron-appindicator');

function createTray() {
  if (tray) {
    console.log('Tray already exists, destroying old tray');
    tray.destroy();
  }

  console.log('Creating new tray');
  const iconPath = path.join(__dirname, 'icon-idle.png');

  if (!isGNOME()) {
    tray.on('right-click', () => {
      tray.popUpContextMenu(contextMenu);
    });

    tray.on('click', handleTrayClick);
  } else {
    tray.setContextMenu(contextMenu);
    tray.on('click', handleTrayClick);
  }

  tray.setToolTip('ClipShare');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  if (!isGNOME()) {
    tray.on('right-click', () => {
      tray.popUpContextMenu(contextMenu);
    });

    tray.on('click', handleTrayClick);
  } else {
    tray.on('status-notifier-click', handleTrayClick);
    tray.setContextMenu(contextMenu);
  }
}

app.on('ready', () => {
  console.log('App is ready');
  createWindow();
  createTray();

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
  setTrayIconRecording(true);
  console.log('Recording started, tray icon updated to recording state.');
});

ipcMain.handle('stop-recording', (event) => {
  setTrayIconRecording(false);
  console.log('Recording stopped, tray icon updated to idle state.');
});

function setTrayIconRecording(isRecording) {
  const iconPath = isRecording ? 'icon-recording.png' : 'icon-idle.png';
  const fullIconPath = path.join(__dirname, iconPath);

  if (isGNOME()) {
    tray.setIcon(fullIconPath);
  } else {
    tray.setImage(fullIconPath);
  }
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
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false,
      permissions: ['camera', 'microphone'],
    },
  });

  cameraWindow.loadFile('camera.html');

  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  cameraWindow.setPosition(20, height - 170);
  cameraWindow.on('closed', () => {
    cameraWindow = null;
  });
}

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
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    console.log('Sources:', sources);
    return sources;
  } catch (error) {
    console.error('Error getting sources:', error);
    throw error;
  }
});

ipcMain.on('save-recording', async (event, buffer) => {
  const fileName = `${ulid()}.webm`;
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ACL: ACL,
      ContentType: 'video/webm',
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
});
