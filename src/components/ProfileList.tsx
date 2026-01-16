import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { Profile } from '../types';

export function ProfileList() {
  const { profiles, settings, isLoading, loadProfileToWoW, deleteProfile } = useAppStore();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showAllVersions, setShowAllVersions] = useState(false);

  const currentVersion = settings?.selectedVersion;
  const currentAccount = settings?.selectedAccount;

  const filteredProfiles = showAllVersions
    ? profiles
    : profiles.filter((p) => p.wowVersion === currentVersion);

  const otherVersionProfiles = profiles.filter((p) => p.wowVersion !== currentVersion);

  const handleLoadProfile = async (profile: Profile) => {
    const isSameVersion = profile.wowVersion === currentVersion;
    const isSameAccount = profile.accountName === currentAccount;

    let message = `Load profile "${profile.name}"?\n\n`;

    if (!isSameVersion) {
      message += `Warning: This profile is for ${formatVersion(profile.wowVersion)}, but you're currently on ${formatVersion(currentVersion || 'unknown')}.\n\n`;
    }

    if (!isSameAccount) {
      message += `Warning: This profile is from account "${profile.accountName}", but you have "${currentAccount}" selected.\n\n`;
    }

    message += 'This will overwrite your current WoW settings. A backup will be created automatically.\n\nMake sure WoW is closed before proceeding.';

    const confirmed = window.confirm(message);

    if (confirmed) {
      await loadProfileToWoW(profile);
      alert('Profile loaded successfully!');
    }
  };

  const handleDeleteProfile = async (id: string) => {
    if (confirmDelete === id) {
      await deleteProfile(id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  if (profiles.length === 0) {
    return (
      <div className="profiles-empty">
        <h2>No Profiles Yet</h2>
        <p>Create your first profile to save your current WoW settings.</p>
        <p className="hint">
          Click the "Create Profile" button below to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="profiles-container">
      <div className="profiles-header">
        <h2>
          Your Profiles
          {!showAllVersions && currentVersion && (
            <span className="profiles-filter-label">
              ({formatVersion(currentVersion)})
            </span>
          )}
        </h2>
        {otherVersionProfiles.length > 0 && (
          <button
            className="btn-secondary btn-small"
            onClick={() => setShowAllVersions(!showAllVersions)}
          >
            {showAllVersions
              ? `Show ${formatVersion(currentVersion || '')} Only`
              : `Show All Versions (${otherVersionProfiles.length} more)`}
          </button>
        )}
      </div>

      {filteredProfiles.length === 0 ? (
        <div className="profiles-empty">
          <p>No profiles for {formatVersion(currentVersion || '')} yet.</p>
          <p className="hint">
            Create a profile or click "Show All Versions" to see profiles from other game versions.
          </p>
        </div>
      ) : (
        <div className="profiles-grid">
          {filteredProfiles.map((profile) => {
            const isCurrentVersion = profile.wowVersion === currentVersion;
            const isCurrentAccount = profile.accountName === currentAccount;

            return (
              <div
                key={profile.id}
                className={`profile-card ${!isCurrentVersion ? 'profile-other-version' : ''}`}
              >
                <div className="profile-header">
                  <h3>{profile.name}</h3>
                  {profile.device && <span className="device-tag">{profile.device}</span>}
                </div>

                {profile.description && (
                  <p className="profile-description">{profile.description}</p>
                )}

                <div className="profile-meta">
                  <span className={`profile-version ${!isCurrentVersion ? 'version-mismatch' : ''}`}>
                    {formatVersion(profile.wowVersion)}
                  </span>
                  <span className={`profile-account ${!isCurrentAccount ? 'account-mismatch' : ''}`}>
                    {profile.accountName}
                  </span>
                </div>

                <div className="profile-addons">
                  <span className="addons-label">Addons:</span>
                  <span className="addons-list">
                    {Object.keys(profile.addons).join(', ') || 'None'}
                  </span>
                </div>

                <div className="profile-stats">
                  {profile.gameSettings && (
                    <span className="stat-badge">Keybinds</span>
                  )}
                  {Object.keys(profile.addons).length > 0 && (
                    <span className="stat-badge">{Object.keys(profile.addons).length} Addons</span>
                  )}
                </div>

                <div className="profile-dates">
                  <span>Created: {formatDate(profile.createdAt)}</span>
                  <span>Updated: {formatDate(profile.updatedAt)}</span>
                </div>

                <div className="profile-actions">
                  <button
                    className="btn-primary"
                    onClick={() => handleLoadProfile(profile)}
                    disabled={isLoading}
                  >
                    Load Profile
                  </button>
                  <button
                    className={`btn-danger ${confirmDelete === profile.id ? 'confirming' : ''}`}
                    onClick={() => handleDeleteProfile(profile.id)}
                  >
                    {confirmDelete === profile.id ? 'Click to Confirm' : 'Delete'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatVersion(version: string): string {
  const names: Record<string, string> = {
    retail: 'Retail',
    classic: 'Classic',
    classic_era: 'Classic Era',
  };
  return names[version] || version;
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
