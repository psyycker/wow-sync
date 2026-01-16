import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { detectWoWPath, validateWoWPath, scanWoWAccounts } from './services/wowDetector.js';
import { ProfileManager } from './services/profileManager.js';
import { SettingsManager } from './services/settingsManager.js';
import { GoogleDriveService } from './services/googleDrive.js';
import type { WoWVersion, AddonName } from '../src/types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let profileManager: ProfileManager;
let settingsManager: SettingsManager;
let googleDriveService: GoogleDriveService;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function setupIpcHandlers() {
  // WoW detection handlers
  ipcMain.handle('wow:detect-path', async () => {
    return detectWoWPath();
  });

  ipcMain.handle('wow:validate-path', async (_event, wowPath: string) => {
    return validateWoWPath(wowPath);
  });

  ipcMain.handle('wow:scan-accounts', async (_event, wowPath: string, version: WoWVersion) => {
    return scanWoWAccounts(wowPath, version);
  });

  // Profile handlers
  ipcMain.handle('profiles:list', async () => {
    return profileManager.listProfiles();
  });

  ipcMain.handle('profiles:get', async (_event, id: string) => {
    return profileManager.getProfile(id);
  });

  ipcMain.handle('profiles:save', async (_event, profile) => {
    return profileManager.saveProfile(profile);
  });

  ipcMain.handle('profiles:delete', async (_event, id: string) => {
    return profileManager.deleteProfile(id);
  });

  ipcMain.handle(
    'profiles:create-from-current',
    async (
      _event,
      name: string,
      wowPath: string,
      version: WoWVersion,
      accountName: string,
      addons: AddonName[]
    ) => {
      return profileManager.createFromCurrentSettings(name, wowPath, version, accountName, addons);
    }
  );

  ipcMain.handle('profiles:load', async (_event, profile, wowPath: string) => {
    return profileManager.loadProfile(profile, wowPath);
  });

  ipcMain.handle(
    'addons:scan-installed',
    async (_event, wowPath: string, version: WoWVersion, accountName: string) => {
      return profileManager.scanInstalledAddons(wowPath, version, accountName);
    }
  );

  // Settings handlers
  ipcMain.handle('settings:get', async () => {
    return settingsManager.getSettings();
  });

  ipcMain.handle('settings:save', async (_event, settings) => {
    return settingsManager.saveSettings(settings);
  });

  ipcMain.handle('dialog:select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: 'Select World of Warcraft Installation Folder',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  // Google Drive handlers
  ipcMain.handle('gdrive:is-configured', async () => {
    return googleDriveService.isConfigured();
  });

  ipcMain.handle('gdrive:get-status', async () => {
    return googleDriveService.getStatus();
  });

  ipcMain.handle('gdrive:connect', async () => {
    try {
      const success = await googleDriveService.authenticate();
      if (success) {
        const status = await googleDriveService.getStatus();
        const settings = await settingsManager.getSettings();
        await settingsManager.saveSettings({
          ...settings,
          googleDriveConnected: true,
          googleDriveEmail: status.email,
        });
      }
      return success;
    } catch (err) {
      console.error('Google Drive connection failed:', err);
      throw err;
    }
  });

  ipcMain.handle('gdrive:disconnect', async () => {
    await googleDriveService.disconnect();
    const settings = await settingsManager.getSettings();
    await settingsManager.saveSettings({
      ...settings,
      googleDriveConnected: false,
      googleDriveEmail: null,
      lastSyncTime: null,
    });
  });

  ipcMain.handle('gdrive:sync', async () => {
    const localProfiles = await profileManager.listProfiles();
    const result = await googleDriveService.syncProfiles(localProfiles);

    // Download any profiles that are newer on remote or only exist remotely
    if (result.downloaded.length > 0) {
      const remoteProfiles = await googleDriveService.pullProfiles();
      for (const remoteProfile of remoteProfiles) {
        const localProfile = localProfiles.find((p) => p.id === remoteProfile.id);
        if (!localProfile || new Date(remoteProfile.updatedAt) > new Date(localProfile.updatedAt)) {
          await profileManager.saveProfile(remoteProfile);
        }
      }
    }

    // Update last sync time
    const settings = await settingsManager.getSettings();
    await settingsManager.saveSettings({
      ...settings,
      lastSyncTime: new Date().toISOString(),
    });

    return result;
  });

  ipcMain.handle('gdrive:push', async () => {
    const localProfiles = await profileManager.listProfiles();
    await googleDriveService.pushAllProfiles(localProfiles);

    const settings = await settingsManager.getSettings();
    await settingsManager.saveSettings({
      ...settings,
      lastSyncTime: new Date().toISOString(),
    });
  });

  ipcMain.handle('gdrive:pull', async () => {
    const remoteProfiles = await googleDriveService.pullProfiles();

    // Save all remote profiles locally
    for (const profile of remoteProfiles) {
      await profileManager.saveProfile(profile);
    }

    const settings = await settingsManager.getSettings();
    await settingsManager.saveSettings({
      ...settings,
      lastSyncTime: new Date().toISOString(),
    });

    return remoteProfiles;
  });
}

app.whenReady().then(() => {
  const userDataPath = app.getPath('userData');
  profileManager = new ProfileManager(userDataPath);
  settingsManager = new SettingsManager(userDataPath);
  googleDriveService = new GoogleDriveService(userDataPath);

  setupIpcHandlers();
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
