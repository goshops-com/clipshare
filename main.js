const { app, BrowserWindow, Tray, Menu, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const AutoLaunch = require('auto-launch');
const { ulid } = require('ulid');
require('dotenv').config();

const AWS = require('aws-sdk');

let tray = null;
let window = null;

// Initialize AutoLaunch
const clipShareAutoLauncher = new AutoLaunch({
    name: 'ClipShare',
    path: app.getPath('exe'),
});

const s3 = new AWS.S3({
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.ACCESS_SECRET, // Replace 'x' with your actual secret access key
    endpoint: process.env.ENDPOINT,
    signatureVersion: 'v4',
    region: process.env.REGION
});

const BUCKET_NAME = 'clipshare';

// Enable AutoLaunch
clipShareAutoLauncher.isEnabled().then((isEnabled) => {
    if (!isEnabled) clipShareAutoLauncher.enable();
}).catch((err) => {
    console.error('AutoLaunch enable error:', err);
});

function createWindow() {
    window = new BrowserWindow({
        width: 300,
        height: 350,
        show: false,
        frame: false,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true  // This is important for accessing desktopCapturer
        }
    });

    window.loadFile('index.html');
    // window.webContents.openDevTools({ mode: 'detach' });  // Enable DevTools
}

function createTray() {
    tray = new Tray(path.join(__dirname, 'icon-idle.png'));
    tray.setToolTip('ClipShare');

    // Create a context menu
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Quit',
            click: () => {
                app.quit(); // Quit the application
            }
        }
    ]);

    // Set the context menu to the tray icon for right-clicks
    tray.on('right-click', () => {
        tray.popUpContextMenu(contextMenu);
    });

    // Handle left-click to toggle the window visibility
    tray.on('click', (event, bounds) => {
        // Bounds: contains the x, y of the mouse click, and height, width of the tray icon
        const { x, y } = bounds;
        const { height, width } = window.getBounds();

        const yPosition = process.platform === 'darwin' ? y : y - height;
        window.setBounds({
            x: x - width / 2,
            y: yPosition,
            height,
            width
        });

        if (window.isVisible()) {
            window.hide();
        } else {
            setTimeout(() => {
                window.show();
                window.focus(); // Bring window to the front
            }, 100);
        }
    });
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
    tray.setImage(path.join(__dirname, iconPath));
}

app.whenReady().then(() => {
    createWindow();
    createTray();
});

let cameraWindow = null;

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
        }
    });

    cameraWindow.loadFile('camera.html');

    // Position the camera window at the bottom left of the screen
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    cameraWindow.setPosition(20, height - 170);
}

ipcMain.handle('toggle-camera', (event, enableCamera) => {
    if (enableCamera) {
        if (!cameraWindow) {
            createCameraWindow();
        }
    } else {
        if (cameraWindow) {
            cameraWindow.close();
            cameraWindow = null;
        }
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
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
        // Upload to S3
        const params = {
            Bucket: BUCKET_NAME,
            Key: fileName,
            Body: buffer,
            ACL: 'public-read',
            ContentType: 'video/webm'
        };

        await s3.upload(params).promise();

        const url = `https://clipshare.gopersonal.com/${fileName}`
        require('electron').shell.openExternal(url);
        event.reply('recording-saved', url);

    } catch (error) {
        console.error('Failed to upload video:', error);
        event.reply('recording-error', error.message);
    }
});