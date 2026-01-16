import { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { WoWPathSetup } from './components/WoWPathSetup';
import { ProfileList } from './components/ProfileList';
import { CreateProfileModal } from './components/CreateProfileModal';
import { SettingsPanel } from './components/SettingsPanel';
import { ContextBar } from './components/ContextBar';
import './App.css';

function App() {
  const { settings, isLoading, error, initialize, setError } = useAppStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading && !settings) {
    return (
      <div className="app loading-screen">
        <div className="loading-content">
          <div className="spinner" />
          <p>Loading WoW Settings Manager...</p>
        </div>
      </div>
    );
  }

  const hasValidPath = settings?.wowPath && settings?.selectedAccount;

  return (
    <div className="app">
      <header className="app-header">
        <h1>WoW Settings Manager</h1>
        <p className="subtitle">Sync your addon settings across devices</p>
      </header>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {hasValidPath && <ContextBar />}

      <main className="app-main">
        {!hasValidPath ? (
          <WoWPathSetup />
        ) : (
          <>
            <ProfileList />
            <CreateProfileModal />
          </>
        )}
      </main>

      <SettingsPanel />
    </div>
  );
}

export default App;
