import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { DetectedWoWPath, WoWVersion, WoWAccount, WoWCharacter } from '../../src/types/index.js';

const execAsync = promisify(exec);

const VERSION_FOLDERS: Record<string, WoWVersion> = {
  '_retail_': 'retail',
  '_classic_': 'classic',
  '_classic_era_': 'classic_era',
};

function getCommonPaths(): string[] {
  const platform = process.platform;

  if (platform === 'darwin') {
    return [
      '/Applications/World of Warcraft',
      path.join(process.env.HOME || '', 'Applications/World of Warcraft'),
    ];
  }

  if (platform === 'win32') {
    return [
      'C:\\Program Files\\World of Warcraft',
      'C:\\Program Files (x86)\\World of Warcraft',
      'D:\\World of Warcraft',
      'D:\\Games\\World of Warcraft',
    ];
  }

  if (platform === 'linux') {
    const homeDir = process.env.HOME || '';
    return [
      path.join(homeDir, '.local/share/Steam/steamapps/compatdata/2121490/pfx/drive_c/Program Files (x86)/World of Warcraft'),
      path.join(homeDir, '.steam/steam/steamapps/compatdata/2121490/pfx/drive_c/Program Files (x86)/World of Warcraft'),
      path.join(homeDir, 'Games/World of Warcraft'),
    ];
  }

  return [];
}

async function getWindowsRegistryPath(): Promise<string | null> {
  if (process.platform !== 'win32') {
    return null;
  }

  try {
    const { stdout } = await execAsync(
      'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Blizzard Entertainment\\World of Warcraft" /v InstallPath'
    );

    const match = stdout.match(/InstallPath\s+REG_SZ\s+(.+)/);
    if (match) {
      return match[1].trim();
    }
  } catch {
    // Registry key not found
  }

  return null;
}

function detectVersions(wowPath: string): WoWVersion[] {
  const versions: WoWVersion[] = [];

  try {
    const entries = fs.readdirSync(wowPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && VERSION_FOLDERS[entry.name]) {
        const versionPath = path.join(wowPath, entry.name);
        const wtfPath = path.join(versionPath, 'WTF');

        if (fs.existsSync(wtfPath)) {
          versions.push(VERSION_FOLDERS[entry.name]);
        }
      }
    }
  } catch {
    // Directory doesn't exist or not readable
  }

  return versions;
}

export async function detectWoWPath(): Promise<DetectedWoWPath | null> {
  const registryPath = await getWindowsRegistryPath();
  if (registryPath) {
    const versions = detectVersions(registryPath);
    if (versions.length > 0) {
      return { path: registryPath, versions };
    }
  }

  const commonPaths = getCommonPaths();

  for (const wowPath of commonPaths) {
    if (fs.existsSync(wowPath)) {
      const versions = detectVersions(wowPath);
      if (versions.length > 0) {
        return { path: wowPath, versions };
      }
    }
  }

  return null;
}

export function validateWoWPath(wowPath: string): DetectedWoWPath | null {
  if (!fs.existsSync(wowPath)) {
    return null;
  }

  const versions = detectVersions(wowPath);

  if (versions.length === 0) {
    return null;
  }

  return { path: wowPath, versions };
}

function getVersionFolder(version: WoWVersion): string {
  const folderMap: Record<WoWVersion, string> = {
    retail: '_retail_',
    classic: '_classic_',
    classic_era: '_classic_era_',
  };
  return folderMap[version];
}

export function scanWoWAccounts(wowPath: string, version: WoWVersion): WoWAccount[] {
  const accounts: WoWAccount[] = [];
  const versionFolder = getVersionFolder(version);
  const wtfPath = path.join(wowPath, versionFolder, 'WTF', 'Account');

  if (!fs.existsSync(wtfPath)) {
    return accounts;
  }

  try {
    const accountDirs = fs.readdirSync(wtfPath, { withFileTypes: true });

    for (const accountDir of accountDirs) {
      if (!accountDir.isDirectory() || accountDir.name === 'SavedVariables') {
        continue;
      }

      const accountPath = path.join(wtfPath, accountDir.name);
      const characters = scanCharacters(accountPath);

      accounts.push({
        name: accountDir.name,
        path: accountPath,
        characters,
      });
    }
  } catch {
    // Failed to read directory
  }

  return accounts;
}

function scanCharacters(accountPath: string): WoWCharacter[] {
  const characters: WoWCharacter[] = [];

  try {
    const realmDirs = fs.readdirSync(accountPath, { withFileTypes: true });

    for (const realmDir of realmDirs) {
      if (!realmDir.isDirectory() || realmDir.name === 'SavedVariables') {
        continue;
      }

      const realmPath = path.join(accountPath, realmDir.name);
      const charDirs = fs.readdirSync(realmPath, { withFileTypes: true });

      for (const charDir of charDirs) {
        if (!charDir.isDirectory()) {
          continue;
        }

        characters.push({
          name: charDir.name,
          realm: realmDir.name,
          path: path.join(realmPath, charDir.name),
        });
      }
    }
  } catch {
    // Failed to read directory
  }

  return characters;
}
