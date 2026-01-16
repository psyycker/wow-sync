import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { AddonName } from '../types';

const AVAILABLE_ADDONS: { name: AddonName; label: string; description: string }[] = [
  { name: 'ElvUI', label: 'ElvUI', description: 'Complete UI replacement framework' },
  { name: 'WeakAuras', label: 'WeakAuras', description: 'Custom UI elements and alerts' },
  { name: 'Details', label: 'Details!', description: 'Damage and healing meter' },
  { name: 'DBM', label: 'Deadly Boss Mods', description: 'Boss encounter alerts' },
  { name: 'BigWigs', label: 'BigWigs', description: 'Boss mod alternative to DBM' },
  { name: 'ConsolePort', label: 'ConsolePort', description: 'Controller support addon' },
  { name: 'Bartender4', label: 'Bartender4', description: 'Action bar customization' },
  { name: 'Dominos', label: 'Dominos', description: 'Action bar addon' },
];

export function CreateProfileModal() {
  const { settings, installedAddons, createProfile, scanInstalledAddons, isLoading } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<AddonName[]>([]);

  useEffect(() => {
    if (isOpen) {
      scanInstalledAddons();
    }
  }, [isOpen, scanInstalledAddons]);

  useEffect(() => {
    if (installedAddons.length > 0) {
      setSelectedAddons(installedAddons);
    }
  }, [installedAddons]);

  const handleToggleAddon = (addon: AddonName) => {
    setSelectedAddons((prev) =>
      prev.includes(addon) ? prev.filter((a) => a !== addon) : [...prev, addon]
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) return;

    const profile = await createProfile(name.trim(), selectedAddons);
    if (profile) {
      setName('');
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim()) {
      handleCreate();
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <>
      <button className="create-profile-button" onClick={() => setIsOpen(true)}>
        + Create Profile
      </button>

      {isOpen && (
        <div className="modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Profile</h2>
              <button className="modal-close" onClick={() => setIsOpen(false)}>
                &times;
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="profile-name">Profile Name</label>
                <input
                  id="profile-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g., Main PC - Healer, Steam Deck"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Include Addons</label>
                <p className="form-hint">
                  Select which addon settings to save. Addons with saved settings are pre-selected.
                </p>
                <div className="addon-checkboxes">
                  {AVAILABLE_ADDONS.map((addon) => {
                    const isInstalled = installedAddons.includes(addon.name);
                    return (
                      <label
                        key={addon.name}
                        className={`addon-checkbox ${!isInstalled ? 'addon-not-installed' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedAddons.includes(addon.name)}
                          onChange={() => handleToggleAddon(addon.name)}
                          disabled={!isInstalled}
                        />
                        <span className="addon-info">
                          <span className="addon-label">
                            {addon.label}
                            {isInstalled && <span className="addon-installed-badge">Installed</span>}
                          </span>
                          <span className="addon-desc">
                            {isInstalled ? addon.description : 'No saved settings found'}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="profile-preview">
                <p>
                  This will save the current settings from:{' '}
                  <strong>{settings?.selectedAccount}</strong>
                </p>
                {installedAddons.length === 0 && (
                  <p className="profile-warning">
                    No addon settings found. Make sure you've logged into the game at least once
                    with your addons enabled.
                  </p>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleCreate}
                disabled={!name.trim() || isLoading || selectedAddons.length === 0}
              >
                {isLoading ? 'Creating...' : 'Create Profile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
