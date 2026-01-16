import { create } from 'zustand';
import type {
  Profile,
  AppSettings,
  WoWAccount,
  DetectedWoWPath,
  WoWVersion,
  AddonName,
  SyncStatus,
  SyncResult,
} from '../types';

interface AppState {
  settings: AppSettings | null;
  profiles: Profile[];
  detectedPath: DetectedWoWPath | null;
  accounts: WoWAccount[];
  installedAddons: AddonName[];
  syncStatus: SyncStatus | null;
  isSyncing: boolean;
  isLoading: boolean;
  error: string | null;
  isSettingsPanelOpen: boolean;

  setSettings: (settings: AppSettings) => void;
  setProfiles: (profiles: Profile[]) => void;
  setDetectedPath: (path: DetectedWoWPath | null) => void;
  setAccounts: (accounts: WoWAccount[]) => void;
  setInstalledAddons: (addons: AddonName[]) => void;
  setSyncStatus: (status: SyncStatus | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSettingsPanelOpen: (open: boolean) => void;

  initialize: () => Promise<void>;
  detectWoWPath: () => Promise<void>;
  selectWoWPath: () => Promise<void>;
  validateAndSetPath: (path: string) => Promise<boolean>;
  scanAccounts: (version: WoWVersion) => Promise<void>;
  scanInstalledAddons: () => Promise<void>;
  loadProfiles: () => Promise<void>;
  createProfile: (name: string, addons: AddonName[]) => Promise<Profile | null>;
  deleteProfile: (id: string) => Promise<void>;
  loadProfileToWoW: (profile: Profile) => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;

  // Google Drive sync actions
  checkGoogleDriveStatus: () => Promise<void>;
  connectGoogleDrive: () => Promise<boolean>;
  disconnectGoogleDrive: () => Promise<void>;
  syncWithGoogleDrive: () => Promise<SyncResult | null>;
  pushToGoogleDrive: () => Promise<void>;
  pullFromGoogleDrive: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  settings: null,
  profiles: [],
  detectedPath: null,
  accounts: [],
  installedAddons: [],
  syncStatus: null,
  isSyncing: false,
  isLoading: false,
  error: null,
  isSettingsPanelOpen: false,

  setSettings: (settings) => set({ settings }),
  setProfiles: (profiles) => set({ profiles }),
  setDetectedPath: (detectedPath) => set({ detectedPath }),
  setAccounts: (accounts) => set({ accounts }),
  setInstalledAddons: (installedAddons) => set({ installedAddons }),
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setSettingsPanelOpen: (isSettingsPanelOpen) => set({ isSettingsPanelOpen }),

  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      const settings = await window.electronAPI.invoke('settings:get');
      set({ settings });

      if (settings.wowPath) {
        const detected = await window.electronAPI.invoke('wow:validate-path', settings.wowPath);
        set({ detectedPath: detected });

        if (detected && settings.selectedVersion) {
          const accounts = await window.electronAPI.invoke(
            'wow:scan-accounts',
            settings.wowPath,
            settings.selectedVersion
          );
          set({ accounts });
        }
      } else {
        await get().detectWoWPath();
      }

      await get().loadProfiles();
      await get().checkGoogleDriveStatus();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to initialize' });
    } finally {
      set({ isLoading: false });
    }
  },

  detectWoWPath: async () => {
    set({ isLoading: true, error: null });
    try {
      const detected = await window.electronAPI.invoke('wow:detect-path');
      set({ detectedPath: detected });

      if (detected) {
        const { settings } = get();
        const version = detected.versions[0];

        const accounts = await window.electronAPI.invoke('wow:scan-accounts', detected.path, version);
        set({ accounts });

        if (settings) {
          await get().updateSettings({
            wowPath: detected.path,
            selectedVersion: version,
          });
        }
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to detect WoW path' });
    } finally {
      set({ isLoading: false });
    }
  },

  selectWoWPath: async () => {
    try {
      const selectedPath = await window.electronAPI.invoke('dialog:select-folder');
      if (selectedPath) {
        await get().validateAndSetPath(selectedPath);
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to select folder' });
    }
  },

  validateAndSetPath: async (path) => {
    set({ isLoading: true, error: null });
    try {
      const detected = await window.electronAPI.invoke('wow:validate-path', path);

      if (!detected) {
        set({ error: 'Invalid WoW installation path. No WTF folder found.' });
        return false;
      }

      set({ detectedPath: detected });

      const version = detected.versions[0];
      const accounts = await window.electronAPI.invoke('wow:scan-accounts', detected.path, version);
      set({ accounts });

      await get().updateSettings({
        wowPath: detected.path,
        selectedVersion: version,
        selectedAccount: accounts.length > 0 ? accounts[0].name : null,
      });

      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to validate path' });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  scanAccounts: async (version) => {
    const { settings } = get();
    if (!settings?.wowPath) return;

    try {
      const accounts = await window.electronAPI.invoke('wow:scan-accounts', settings.wowPath, version);
      set({ accounts });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to scan accounts' });
    }
  },

  scanInstalledAddons: async () => {
    const { settings } = get();
    if (!settings?.wowPath || !settings.selectedVersion || !settings.selectedAccount) {
      return;
    }

    try {
      const installedAddons = await window.electronAPI.invoke(
        'addons:scan-installed',
        settings.wowPath,
        settings.selectedVersion,
        settings.selectedAccount
      );
      set({ installedAddons });
    } catch (err) {
      console.error('Failed to scan installed addons:', err);
    }
  },

  loadProfiles: async () => {
    try {
      const profiles = await window.electronAPI.invoke('profiles:list');
      set({ profiles });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load profiles' });
    }
  },

  createProfile: async (name, addons) => {
    const { settings } = get();
    if (!settings?.wowPath || !settings.selectedVersion || !settings.selectedAccount) {
      set({ error: 'Please configure WoW path and select an account first' });
      return null;
    }

    set({ isLoading: true, error: null });
    try {
      const profile = await window.electronAPI.invoke(
        'profiles:create-from-current',
        name,
        settings.wowPath,
        settings.selectedVersion,
        settings.selectedAccount,
        addons
      );

      await get().loadProfiles();
      return profile;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create profile' });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteProfile: async (id) => {
    try {
      await window.electronAPI.invoke('profiles:delete', id);
      await get().loadProfiles();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete profile' });
    }
  },

  loadProfileToWoW: async (profile) => {
    const { settings } = get();
    if (!settings?.wowPath) {
      set({ error: 'WoW path not configured' });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      await window.electronAPI.invoke('profiles:load', profile, settings.wowPath);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load profile' });
    } finally {
      set({ isLoading: false });
    }
  },

  updateSettings: async (newSettings) => {
    const { settings } = get();
    if (!settings) return;

    const updated = { ...settings, ...newSettings };
    await window.electronAPI.invoke('settings:save', updated);
    set({ settings: updated });
  },

  // Google Drive sync actions
  checkGoogleDriveStatus: async () => {
    try {
      const isConfigured = await window.electronAPI.invoke('gdrive:is-configured');
      if (!isConfigured) {
        set({ syncStatus: { connected: false, lastSyncTime: null, email: null } });
        return;
      }

      const status = await window.electronAPI.invoke('gdrive:get-status');
      set({ syncStatus: status });

      // Update settings if connection status changed
      const { settings } = get();
      if (settings && settings.googleDriveConnected !== status.connected) {
        await get().updateSettings({
          googleDriveConnected: status.connected,
          googleDriveEmail: status.email,
        });
      }
    } catch (err) {
      console.error('Failed to check Google Drive status:', err);
    }
  },

  connectGoogleDrive: async () => {
    set({ isSyncing: true, error: null });
    try {
      const success = await window.electronAPI.invoke('gdrive:connect');
      if (success) {
        await get().checkGoogleDriveStatus();
        // Refresh settings to get updated connection status
        const settings = await window.electronAPI.invoke('settings:get');
        set({ settings });
      }
      return success;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to connect to Google Drive' });
      return false;
    } finally {
      set({ isSyncing: false });
    }
  },

  disconnectGoogleDrive: async () => {
    set({ isSyncing: true, error: null });
    try {
      await window.electronAPI.invoke('gdrive:disconnect');
      set({ syncStatus: { connected: false, lastSyncTime: null, email: null } });
      // Refresh settings
      const settings = await window.electronAPI.invoke('settings:get');
      set({ settings });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to disconnect from Google Drive' });
    } finally {
      set({ isSyncing: false });
    }
  },

  syncWithGoogleDrive: async () => {
    set({ isSyncing: true, error: null });
    try {
      const result = await window.electronAPI.invoke('gdrive:sync');
      await get().loadProfiles();
      // Refresh settings to get updated lastSyncTime
      const settings = await window.electronAPI.invoke('settings:get');
      set({ settings });
      return result;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to sync with Google Drive' });
      return null;
    } finally {
      set({ isSyncing: false });
    }
  },

  pushToGoogleDrive: async () => {
    set({ isSyncing: true, error: null });
    try {
      await window.electronAPI.invoke('gdrive:push');
      // Refresh settings to get updated lastSyncTime
      const settings = await window.electronAPI.invoke('settings:get');
      set({ settings });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to push to Google Drive' });
    } finally {
      set({ isSyncing: false });
    }
  },

  pullFromGoogleDrive: async () => {
    set({ isSyncing: true, error: null });
    try {
      await window.electronAPI.invoke('gdrive:pull');
      await get().loadProfiles();
      // Refresh settings to get updated lastSyncTime
      const settings = await window.electronAPI.invoke('settings:get');
      set({ settings });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to pull from Google Drive' });
    } finally {
      set({ isSyncing: false });
    }
  },
}));
