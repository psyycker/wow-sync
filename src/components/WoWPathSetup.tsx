import { useAppStore } from '../store/useAppStore';
import type { WoWVersion } from '../types';

export function WoWPathSetup() {
  const {
    settings,
    detectedPath,
    accounts,
    isLoading,
    selectWoWPath,
    detectWoWPath,
    scanAccounts,
    updateSettings,
  } = useAppStore();

  const handleVersionChange = async (version: WoWVersion) => {
    await updateSettings({ selectedVersion: version, selectedAccount: null });
    await scanAccounts(version);
  };

  const handleAccountChange = async (accountName: string) => {
    await updateSettings({ selectedAccount: accountName });
  };

  return (
    <div className="setup-container">
      <div className="setup-card">
        <h2>Welcome to WoW Settings Manager</h2>
        <p>Let's set up your World of Warcraft installation.</p>

        <div className="setup-section">
          <h3>WoW Installation Path</h3>

          {detectedPath ? (
            <div className="detected-path">
              <div className="path-info">
                <span className="path-label">Detected:</span>
                <span className="path-value">{detectedPath.path}</span>
              </div>
              <div className="versions-available">
                <span className="versions-label">Available versions:</span>
                <span className="versions-list">{detectedPath.versions.join(', ')}</span>
              </div>
            </div>
          ) : (
            <div className="no-path">
              <p>No WoW installation detected automatically.</p>
            </div>
          )}

          <div className="path-actions">
            <button onClick={detectWoWPath} disabled={isLoading}>
              Auto-Detect
            </button>
            <button onClick={selectWoWPath} disabled={isLoading}>
              Browse...
            </button>
          </div>
        </div>

        {detectedPath && detectedPath.versions.length > 0 && (
          <div className="setup-section">
            <h3>Game Version</h3>
            <div className="version-selector">
              {detectedPath.versions.map((version) => (
                <label key={version} className="version-option">
                  <input
                    type="radio"
                    name="version"
                    value={version}
                    checked={settings?.selectedVersion === version}
                    onChange={() => handleVersionChange(version)}
                  />
                  <span className="version-name">{formatVersion(version)}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {accounts.length > 0 && (
          <div className="setup-section">
            <h3>Account</h3>
            <select
              value={settings?.selectedAccount || ''}
              onChange={(e) => handleAccountChange(e.target.value)}
              className="account-select"
            >
              <option value="">Select an account...</option>
              {accounts.map((account) => (
                <option key={account.name} value={account.name}>
                  {account.name} ({account.characters.length} characters)
                </option>
              ))}
            </select>
          </div>
        )}

        {settings?.selectedAccount && (
          <div className="setup-complete">
            <p>Setup complete! You can now create and manage profiles.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatVersion(version: WoWVersion): string {
  const names: Record<WoWVersion, string> = {
    retail: 'Retail (Dragonflight)',
    classic: 'Classic (Cataclysm)',
    classic_era: 'Classic Era (Vanilla)',
  };
  return names[version];
}
