import { useAppStore } from '../store/useAppStore';
import type { WoWVersion } from '../types';

const VERSION_LABELS: Record<WoWVersion, string> = {
  retail: 'Retail',
  classic: 'Classic',
  classic_era: 'Classic Era',
};

export function ContextBar() {
  const {
    settings,
    detectedPath,
    accounts,
    syncStatus,
    isSyncing,
    updateSettings,
    scanAccounts,
    scanInstalledAddons,
    syncWithGoogleDrive,
    setSettingsPanelOpen,
  } = useAppStore();

  if (!settings || !detectedPath) return null;

  const handleVersionChange = async (version: WoWVersion) => {
    await updateSettings({ selectedVersion: version, selectedAccount: null });
    await scanAccounts(version);
  };

  const handleAccountChange = async (accountName: string) => {
    await updateSettings({ selectedAccount: accountName });
    await scanInstalledAddons();
  };

  const handleSyncClick = async () => {
    const isConnected = syncStatus?.connected || settings?.googleDriveConnected;
    if (isConnected) {
      await syncWithGoogleDrive();
    } else {
      setSettingsPanelOpen(true);
    }
  };

  // syncStatus is null when OAuth is not configured
  const isConfigured = syncStatus !== null;
  const isConnected = syncStatus?.connected || settings?.googleDriveConnected;

  return (
    <div className="context-bar">
      <div className="context-item">
        <label>Game Version:</label>
        <select
          value={settings.selectedVersion || ''}
          onChange={(e) => handleVersionChange(e.target.value as WoWVersion)}
        >
          {detectedPath.versions.map((version) => (
            <option key={version} value={version}>
              {VERSION_LABELS[version]}
            </option>
          ))}
        </select>
      </div>

      <div className="context-item">
        <label>Account:</label>
        <select
          value={settings.selectedAccount || ''}
          onChange={(e) => handleAccountChange(e.target.value)}
        >
          <option value="">Select account...</option>
          {accounts.map((account) => (
            <option key={account.name} value={account.name}>
              {account.name} ({account.characters.length} chars)
            </option>
          ))}
        </select>
      </div>

      {isConfigured && (
        <button
          className="context-bar-sync"
          onClick={handleSyncClick}
          disabled={isSyncing}
        >
          {isSyncing ? 'Syncing...' : isConnected ? '☁ Sync' : '☁ Connect'}
        </button>
      )}
    </div>
  );
}
