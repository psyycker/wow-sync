export type AddonName =
  | 'ConsolePort'
  | 'ElvUI'
  | 'WeakAuras'
  | 'Details'
  | 'DBM'
  | 'BigWigs'
  | 'Bartender4'
  | 'Dominos';

export interface AddonConfig {
  enabled: boolean;
  files: Record<string, string>;
}

export interface Profile {
  id: string;
  name: string;
  description?: string;
  device?: string;
  createdAt: string;
  updatedAt: string;
  wowVersion: WoWVersion;
  accountName?: string;
  addons: Partial<Record<AddonName, AddonConfig>>;
  gameSettings?: string;
}

export type WoWVersion = 'retail' | 'classic' | 'classic_era';

export interface WoWInstallation {
  path: string;
  version: WoWVersion;
  accounts: WoWAccount[];
}

export interface WoWAccount {
  name: string;
  path: string;
  characters: WoWCharacter[];
}

export interface WoWCharacter {
  name: string;
  realm: string;
  path: string;
}

export interface AppSettings {
  wowPath: string | null;
  selectedVersion: WoWVersion | null;
  selectedAccount: string | null;
  enabledAddons: AddonName[];
  googleDriveConnected: boolean;
  googleDriveEmail: string | null;
  autoSync: boolean;
  lastSyncTime: string | null;
}

export interface DetectedWoWPath {
  path: string;
  versions: WoWVersion[];
}

export interface SyncStatus {
  connected: boolean;
  lastSyncTime: string | null;
  email: string | null;
}

export interface SyncResult {
  uploaded: string[];
  downloaded: string[];
  conflicts: string[];
}

export interface IPCChannels {
  'wow:detect-path': () => Promise<DetectedWoWPath | null>;
  'wow:validate-path': (path: string) => Promise<DetectedWoWPath | null>;
  'wow:scan-accounts': (path: string, version: WoWVersion) => Promise<WoWAccount[]>;
  'profiles:list': () => Promise<Profile[]>;
  'profiles:get': (id: string) => Promise<Profile | null>;
  'profiles:save': (profile: Profile) => Promise<void>;
  'profiles:delete': (id: string) => Promise<void>;
  'profiles:create-from-current': (
    name: string,
    wowPath: string,
    version: WoWVersion,
    accountName: string,
    addons: AddonName[]
  ) => Promise<Profile>;
  'profiles:load': (profile: Profile, wowPath: string) => Promise<void>;
  'addons:scan-installed': (wowPath: string, version: WoWVersion, accountName: string) => Promise<AddonName[]>;
  'settings:get': () => Promise<AppSettings>;
  'settings:save': (settings: AppSettings) => Promise<void>;
  'dialog:select-folder': () => Promise<string | null>;
  'gdrive:is-configured': () => Promise<boolean>;
  'gdrive:get-status': () => Promise<SyncStatus>;
  'gdrive:connect': () => Promise<boolean>;
  'gdrive:disconnect': () => Promise<void>;
  'gdrive:sync': () => Promise<SyncResult>;
  'gdrive:push': () => Promise<void>;
  'gdrive:pull': () => Promise<Profile[]>;
}

export interface ElectronAPI {
  invoke<K extends keyof IPCChannels>(
    channel: K,
    ...args: Parameters<IPCChannels[K]>
  ): ReturnType<IPCChannels[K]>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
