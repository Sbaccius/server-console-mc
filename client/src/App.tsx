import { useState } from 'react';
import { Dashboard } from './Dashboard';
import { Workspace } from './Workspace';

function App() {
  const [activeServerId, setActiveServerId] = useState<string | null>(null);

  const handleServerSelect = (serverId: string) => {
    setActiveServerId(serverId);
  };

  const handleBackToHub = () => {
    setActiveServerId(null);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: 'var(--bg-dark)' }}>
      {activeServerId ? (
        <Workspace serverId={activeServerId} onBack={handleBackToHub} />
      ) : (
        <Dashboard onServerSelect={handleServerSelect} />
      )}
    </div>
  );
}

export default App;
