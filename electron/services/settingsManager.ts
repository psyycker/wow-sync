import fs from 'fs';
import path from 'path';
import type { AppSettings } from '../../src/types/index.js';

const DEFAULT_SETTINGS: AppSettings = {
  wowPath: null,
  selectedVersion: null,
  selectedAccount: null,
  enabledAddons: ['ElvUI', 'WeakAuras', 'Details', 'DBM', 'ConsolePort'],
  googleDriveConnected: false,
  googleDriveEmail: null,
  autoSync: false,
  lastSyncTime: null,
};

export class SettingsManager {
  private settingsPath: string;

  constructor(userDataPath: string) {
    this.settingsPath = path.join(userDataPath, 'settings.json');
  }

  async getSettings(): Promise<AppSettings> {
    if (!fs.existsSync(this.settingsPath)) {
      return { ...DEFAULT_SETTINGS };
    }

    try {
      const content = fs.readFileSync(this.settingsPath, 'utf-8');
      const settings = JSON.parse(content) as Partial<AppSettings>;
      return { ...DEFAULT_SETTINGS, ...settings };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    const dirPath = path.dirname(this.settingsPath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2));
  }
}
