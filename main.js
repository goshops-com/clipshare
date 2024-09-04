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

const BUCKET_NAME = process.env.BUCKET_NAME;
const ACL = process.env.ACL || 'public-read';
const PRESIGN_URL = String(process.env.PRESIGN_URL).toLowerCase() === 'true';
const PRESIGN_URL_EXPIRY =
  parseInt(process.env.PRESIGN_URL_EXPIRY, 10) || 86400;

if (!BUCKET_NAME || !process.env.ACCESS_KEY || !process.env.ACCESS_SECRET) {
  console.error(
    'Configuration error: BUCKET_NAME, ACCESS_KEY, or ACCESS_SECRET is not defined.'
  );
}

// Initialize AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.ACCESS_KEY,
  secretAccessKey: process.env.ACCESS_SECRET,
  endpoint: process.env.ENDPOINT,
  signatureVersion: 'v4',
  region: process.env.REGION,
});

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
    show: true,
    frame: true,
    resizable: true,
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
  createTray();
  if (!BUCKET_NAME || !process.env.ACCESS_KEY || !process.env.ACCESS_SECRET) {
    window.webContents.send('config-error');
  }
});

function cleanupAndRecreate() {
  console.log('Performing periodic cleanup and recreation');
  if (tray) {
    tray.destroy();
  }
  createTray();
}

function setTrayIconRecording(isRecording) {
  const iconPath = isRecording ? 'icon-recording.png' : 'icon-idle.png';
  tray.setImage(path.join(__dirname, iconPath));
}

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
    return 'unknown';
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (window === null) {
    createWindow();
  }
});

setInterval(cleanupAndRecreate, 24 * 60 * 60 * 1000); // Every 24 hours

ipcMain.on('quit-app', () => {
  console.log('Quit app request received');
  app.quit();
});
