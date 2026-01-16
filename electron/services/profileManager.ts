import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Profile, WoWVersion, AddonName, AddonConfig } from '../../src/types/index.js';

interface AddonFileConfig {
  accountLevel: string[];
  characterLevel?: string[];
}

const ADDON_FILES: Record<AddonName, AddonFileConfig> = {
  ConsolePort: {
    accountLevel: ['ConsolePort.lua', 'ConsolePortBar.lua', 'ConsolePort_Config.lua'],
  },
  ElvUI: {
    accountLevel: ['ElvUI.lua'],
    characterLevel: ['ElvUI.lua'],
  },
  WeakAuras: {
    accountLevel: ['WeakAuras.lua', 'WeakAurasSaved.lua'],
  },
  Details: {
    accountLevel: ['Details.lua', 'Details_DataStorage.lua'],
  },
  DBM: {
    accountLevel: ['DBM-Core.lua', 'DBM-StatusBarTimers.lua'],
    characterLevel: ['DBM-Core.lua'],
  },
  BigWigs: {
    accountLevel: ['BigWigs.lua'],
    characterLevel: ['BigWigs.lua'],
  },
  Bartender4: {
    accountLevel: ['Bartender4.lua'],
    characterLevel: ['Bartender4.lua'],
  },
  Dominos: {
    accountLevel: ['Dominos.lua'],
    characterLevel: ['Dominos.lua'],
  },
};

function getVersionFolder(version: WoWVersion): string {
  const folderMap: Record<WoWVersion, string> = {
    retail: '_retail_',
    classic: '_classic_',
    classic_era: '_classic_era_',
  };
  return folderMap[version];
}

export class ProfileManager {
  private profilesDir: string;
  private backupsDir: string;

  constructor(userDataPath: string) {
    this.profilesDir = path.join(userDataPath, 'profiles');
    this.backupsDir = path.join(userDataPath, 'backups');
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.profilesDir)) {
      fs.mkdirSync(this.profilesDir, { recursive: true });
    }
    if (!fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true });
    }
  }

  async listProfiles(): Promise<Profile[]> {
    const profiles: Profile[] = [];

    try {
      const files = fs.readdirSync(this.profilesDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = fs.readFileSync(path.join(this.profilesDir, file), 'utf-8');
          profiles.push(JSON.parse(content) as Profile);
        }
      }
    } catch {
      // Directory doesn't exist or is empty
    }

    return profiles.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async getProfile(id: string): Promise<Profile | null> {
    const filePath = path.join(this.profilesDir, `${id}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as Profile;
  }

  async saveProfile(profile: Profile): Promise<void> {
    profile.updatedAt = new Date().toISOString();
    const filePath = path.join(this.profilesDir, `${profile.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(profile, null, 2));
  }

  async deleteProfile(id: string): Promise<void> {
    const filePath = path.join(this.profilesDir, `${id}.json`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  scanInstalledAddons(
    wowPath: string,
    version: WoWVersion,
    accountName: string
  ): AddonName[] {
    const versionFolder = getVersionFolder(version);
    const savedVarsPath = path.join(wowPath, versionFolder, 'WTF', 'Account', accountName, 'SavedVariables');
    const installedAddons: AddonName[] = [];

    if (!fs.existsSync(savedVarsPath)) {
      console.log('DEBUG SavedVariables path does not exist:', savedVarsPath);
      return installedAddons;
    }

    console.log('DEBUG Scanning SavedVariables at:', savedVarsPath);

    const existingFiles = fs.readdirSync(savedVarsPath);
    console.log('DEBUG Found files:', existingFiles.filter(f => f.endsWith('.lua')));

    for (const [addonName, config] of Object.entries(ADDON_FILES)) {
      const hasAnyFile = config.accountLevel.some(fileName =>
        existingFiles.includes(fileName)
      );
      if (hasAnyFile) {
        installedAddons.push(addonName as AddonName);
      }
    }

    console.log('DEBUG Detected installed addons:', installedAddons);
    return installedAddons;
  }

  async createFromCurrentSettings(
    name: string,
    wowPath: string,
    version: WoWVersion,
    accountName: string,
    addons: AddonName[]
  ): Promise<Profile> {
    const versionFolder = getVersionFolder(version);
    const accountPath = path.join(wowPath, versionFolder, 'WTF', 'Account', accountName);
    const savedVarsPath = path.join(accountPath, 'SavedVariables');

    console.log('DEBUG Creating profile from:', savedVarsPath);
    console.log('DEBUG Requested addons:', addons);

    const profile: Profile = {
      id: uuidv4(),
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      wowVersion: version,
      accountName,
      addons: {},
    };

    if (!fs.existsSync(savedVarsPath)) {
      console.log('DEBUG SavedVariables folder does not exist!');
      await this.saveProfile(profile);
      return profile;
    }

    const existingFiles = fs.readdirSync(savedVarsPath);
    console.log('DEBUG Available .lua files:', existingFiles.filter(f => f.endsWith('.lua')));

    for (const addonName of addons) {
      const addonConfig = ADDON_FILES[addonName];
      if (!addonConfig) {
        console.log('DEBUG No config for addon:', addonName);
        continue;
      }

      const addonData: AddonConfig = {
        enabled: true,
        files: {},
      };

      for (const fileName of addonConfig.accountLevel) {
        const filePath = path.join(savedVarsPath, fileName);
        if (fs.existsSync(filePath)) {
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            addonData.files[`account/${fileName}`] = content;
            console.log('DEBUG Read file:', fileName, '- Size:', content.length, 'bytes');
          } catch (err) {
            console.log('DEBUG Error reading file:', fileName, err);
          }
        } else {
          console.log('DEBUG File not found:', fileName);
        }
      }

      if (Object.keys(addonData.files).length > 0) {
        profile.addons[addonName] = addonData;
        console.log('DEBUG Added addon to profile:', addonName);
      }
    }

    // Also save game settings (keybinds, macros, etc.)
    const configCachePath = path.join(accountPath, 'config-cache.wtf');
    if (fs.existsSync(configCachePath)) {
      try {
        profile.gameSettings = fs.readFileSync(configCachePath, 'utf-8');
        console.log('DEBUG Read config-cache.wtf - Size:', profile.gameSettings.length, 'bytes');
      } catch (err) {
        console.log('DEBUG Error reading config-cache.wtf:', err);
      }
    }

    console.log('DEBUG Final profile addons:', Object.keys(profile.addons));
    await this.saveProfile(profile);
    return profile;
  }

  async loadProfile(profile: Profile, wowPath: string): Promise<void> {
    const versionFolder = getVersionFolder(profile.wowVersion);
    const accountPath = path.join(
      wowPath,
      versionFolder,
      'WTF',
      'Account',
      profile.accountName || ''
    );
    const savedVarsPath = path.join(accountPath, 'SavedVariables');

    await this.createBackup(wowPath, profile.wowVersion, profile.accountName || '');

    for (const [, addonConfig] of Object.entries(profile.addons)) {
      if (!addonConfig?.enabled) continue;

      for (const [fileKey, content] of Object.entries(addonConfig.files)) {
        const [level, fileName] = fileKey.split('/');

        let targetPath: string;
        if (level === 'account') {
          targetPath = path.join(savedVarsPath, fileName);
        } else {
          continue;
        }

        const targetDir = path.dirname(targetPath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        fs.writeFileSync(targetPath, content);
      }
    }

    if (profile.gameSettings) {
      const configCachePath = path.join(accountPath, 'config-cache.wtf');
      fs.writeFileSync(configCachePath, profile.gameSettings);
    }
  }

  private async createBackup(
    wowPath: string,
    version: WoWVersion,
    accountName: string
  ): Promise<void> {
    const versionFolder = getVersionFolder(version);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.backupsDir, `${accountName}-${timestamp}`);

    const savedVarsPath = path.join(
      wowPath,
      versionFolder,
      'WTF',
      'Account',
      accountName,
      'SavedVariables'
    );

    if (!fs.existsSync(savedVarsPath)) {
      return;
    }

    fs.mkdirSync(backupDir, { recursive: true });

    const files = fs.readdirSync(savedVarsPath);
    for (const file of files) {
      if (file.endsWith('.lua') || file.endsWith('.lua.bak')) {
        const source = path.join(savedVarsPath, file);
        const dest = path.join(backupDir, file);
        fs.copyFileSync(source, dest);
      }
    }
  }
}
