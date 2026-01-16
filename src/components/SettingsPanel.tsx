import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { WoWVersion } from '../types';

export function SettingsPanel() {
  const {
    settings,
    detectedPath,
    accounts,
    syncStatus,
    isSyncing,
    isSettingsPanelOpen,
    selectWoWPath,
    scanAccounts,
    updateSettings,
    connectGoogleDrive,
    disconnectGoogleDrive,
    syncWithGoogleDrive,
    pushToGoogleDrive,
    pullFromGoogleDrive,
    setSettingsPanelOpen,
  } = useAppStore();

  const [lastSyncResult, setLastSyncResult] = useState<string | null>(null);

  const handleVersionChange = async (version: WoWVersion) => {
    await updateSettings({ selectedVersion: version, selectedAccount: null });
    await scanAccounts(version);
  };

  const handleAccountChange = async (accountName: string) => {
    await updateSettings({ selectedAccount: accountName });
  };

  const handleConnect = async () => {
    const success = await connectGoogleDrive();
    if (success) {
      setLastSyncResult('Connected successfully!');
    }
  };

  const handleDisconnect = async () => {
    const confirmed = window.confirm(
      'Disconnect from Google Drive?\n\nYour profiles will remain locally, but will no longer sync.'
    );
    if (confirmed) {
      await disconnectGoogleDrive();
      setLastSyncResult(null);
    }
  };

  const handleSync = async () => {
    const result = await syncWithGoogleDrive();
    if (result) {
      const parts: string[] = [];
      if (result.uploaded.length > 0) {
        parts.push(`Uploaded: ${result.uploaded.length}`);
      }
      if (result.downloaded.length > 0) {
        parts.push(`Downloaded: ${result.downloaded.length}`);
      }
      if (parts.length === 0) {
        setLastSyncResult('Everything is up to date!');
      } else {
        setLastSyncResult(parts.join(', '));
      }
    }
  };

  const handlePush = async () => {
    const confirmed = window.confirm(
      'Push all local profiles to Google Drive?\n\nThis will overwrite any remote profiles with the same ID.'
    );
    if (confirmed) {
      await pushToGoogleDrive();
      setLastSyncResult('All profiles pushed to Google Drive');
    }
  };

  const handlePull = async () => {
    const confirmed = window.confirm(
      'Pull all profiles from Google Drive?\n\nThis will overwrite any local profiles with the same ID.'
    );
    if (confirmed) {
      await pullFromGoogleDrive();
      setLastSyncResult('All profiles pulled from Google Drive');
    }
  };

  if (!settings) return null;

  const isConnected = syncStatus?.connected || settings.googleDriveConnected;
  const isConfigured = syncStatus !== null;

  return (
    <>
      <button className="settings-toggle" onClick={() => setSettingsPanelOpen(!isSettingsPanelOpen)}>
        Settings
      </button>

      {isSettingsPanelOpen && (
        <div className="settings-panel">
          <div className="settings-header">
            <h2>Settings</h2>
            <button className="settings-close" onClick={() => setSettingsPanelOpen(false)}>
              &times;
            </button>
          </div>

          <div className="settings-content">
            <div className="settings-section">
              <h3>WoW Installation</h3>
              <div className="settings-field">
                <label>Installation Path</label>
                <div className="path-field">
                  <input
                    type="text"
                    value={settings.wowPath || 'Not set'}
                    readOnly
                  />
                  <button onClick={selectWoWPath}>Change</button>
                </div>
              </div>

              {detectedPath && detectedPath.versions.length > 0 && (
                <div className="settings-field">
                  <label>Game Version</label>
                  <select
                    value={settings.selectedVersion || ''}
                    onChange={(e) => handleVersionChange(e.target.value as WoWVersion)}
                  >
                    {detectedPath.versions.map((version) => (
                      <option key={version} value={version}>
                        {formatVersion(version)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {accounts.length > 0 && (
                <div className="settings-field">
                  <label>Account</label>
                  <select
                    value={settings.selectedAccount || ''}
                    onChange={(e) => handleAccountChange(e.target.value)}
                  >
                    <option value="">Select account...</option>
                    {accounts.map((account) => (
                      <option key={account.name} value={account.name}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="settings-section">
              <h3>Google Drive Sync</h3>

              {!isConfigured ? (
                <div className="sync-not-configured">
                  <p>Google Drive sync is not configured.</p>
                  <p className="settings-hint">
                    To enable sync, set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables in your .env file.
                  </p>
                </div>
              ) : isConnected ? (
                <div className="sync-connected">
                  <div className="sync-status-row">
                    <span className="sync-status connected">Connected</span>
                    {settings.googleDriveEmail && (
                      <span className="sync-email">{settings.googleDriveEmail}</span>
                    )}
                  </div>

                  {settings.lastSyncTime && (
                    <p className="last-sync-time">
                      Last synced: {formatDate(settings.lastSyncTime)}
                    </p>
                  )}

                  {lastSyncResult && (
                    <div className="sync-result">
                      {lastSyncResult}
                    </div>
                  )}

                  <div className="sync-actions">
                    <button
                      className="btn-primary"
                      onClick={handleSync}
                      disabled={isSyncing}
                    >
                      {isSyncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                  </div>

                  <div className="sync-actions-secondary">
                    <button
                      className="btn-secondary btn-small"
                      onClick={handlePush}
                      disabled={isSyncing}
                    >
                      Push All
                    </button>
                    <button
                      className="btn-secondary btn-small"
                      onClick={handlePull}
                      disabled={isSyncing}
                    >
                      Pull All
                    </button>
                    <button
                      className="btn-danger btn-small"
                      onClick={handleDisconnect}
                      disabled={isSyncing}
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <div className="sync-disconnected">
                  <p>Connect to Google Drive to sync your profiles across devices.</p>
                  <button
                    className="btn-primary"
                    onClick={handleConnect}
                    disabled={isSyncing}
                  >
                    {isSyncing ? 'Connecting...' : 'Connect to Google Drive'}
                  </button>
                  <p className="settings-hint">
                    Your profiles will be stored in a private app folder in your Google Drive.
                  </p>
                </div>
              )}
            </div>

            <div className="settings-section">
              <h3>About</h3>
              <p className="about-text">
                WoW Settings Manager v1.0.0
                <br />
                Sync your addon settings across devices
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function formatVersion(version: WoWVersion): string {
  const names: Record<WoWVersion, string> = {
    retail: 'Retail',
    classic: 'Classic',
    classic_era: 'Classic Era',
  };
  return names[version];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
