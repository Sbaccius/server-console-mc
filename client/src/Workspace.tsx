import { useState } from 'react';
import { Terminal, Database, Settings as SettingsIcon, ArrowLeft, Users, Globe, Package, Wifi } from 'lucide-react';
import { Console } from './Console';
import { Config } from './Config';
import { FileManager } from './FileManager';
import { Plugins } from './Plugins';
import { Players } from './Players';
import { World } from './World';
import { Network } from './Network';

interface WorkspaceProps {
    serverId: string;
    onBack: () => void;
}

export function Workspace({ serverId, onBack }: WorkspaceProps) {
    const [activeTab, setActiveTab] = useState<'console' | 'config' | 'files' | 'plugins' | 'players' | 'world' | 'network'>('console');

    return (
        <div className="app-container">
            {/* Workspace Server Sidebar */}
            <div className="sidebar" style={{ width: '260px', backgroundColor: '#090f1b' }}>
                <button
                    onClick={onBack}
                    className="btn-back"
                >
                    <ArrowLeft size={16} />
                    Back to Hub
                </button>

                <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                        Workspace
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '18px', color: 'var(--text-main)', wordBreak: 'break-all' }}>
                        {serverId}
                    </div>
                </div>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <button
                        className={`nav-link ${activeTab === 'console' ? 'active' : ''}`}
                        onClick={() => setActiveTab('console')}
                        style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                    >
                        <Terminal size={18} />
                        Console
                    </button>

                    <button
                        className={`nav-link ${activeTab === 'players' ? 'active' : ''}`}
                        onClick={() => setActiveTab('players')}
                        style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                    >
                        <Users size={18} />
                        Players
                    </button>

                    <button
                        className={`nav-link ${activeTab === 'world' ? 'active' : ''}`}
                        onClick={() => setActiveTab('world')}
                        style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                    >
                        <Globe size={18} />
                        World
                    </button>

                    <button
                        className={`nav-link ${activeTab === 'network' ? 'active' : ''}`}
                        onClick={() => setActiveTab('network')}
                        style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                    >
                        <Wifi size={18} />
                        Network
                    </button>

                    <button
                        className={`nav-link ${activeTab === 'config' ? 'active' : ''}`}
                        onClick={() => setActiveTab('config')}
                        style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                    >
                        <SettingsIcon size={18} />
                        Configuration
                    </button>

                    <button
                        className={`nav-link ${activeTab === 'files' ? 'active' : ''}`}
                        onClick={() => setActiveTab('files')}
                        style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                    >
                        <Database size={18} />
                        File Manager
                    </button>

                    <button
                        className={`nav-link ${activeTab === 'plugins' ? 'active' : ''}`}
                        onClick={() => setActiveTab('plugins')}
                        style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                    >
                        <Package size={18} />
                        Plugins & Mods
                    </button>
                </nav>
            </div>

            {/* Main Workspace Content */}
            <div className="main-content">
                <div className="top-header" style={{ height: '60px', padding: '0 24px' }}>
                    <div className="header-title" style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{serverId}</span>
                        <span style={{ color: 'var(--border-color)' }}>/</span>
                        <span>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</span>
                    </div>
                </div>
                <div className="page-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
                    {activeTab === 'console' && <Console serverId={serverId} />}
                    {activeTab === 'players' && <Players serverId={serverId} />}
                    {activeTab === 'world' && <World serverId={serverId} />}
                    {activeTab === 'network' && <Network serverId={serverId} />}
                    {activeTab === 'config' && <Config serverId={serverId} />}
                    {activeTab === 'files' && <FileManager serverId={serverId} />}
                    {activeTab === 'plugins' && <Plugins serverId={serverId} />}
                </div>
            </div>
        </div>
    );
}
