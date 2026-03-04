import { useEffect, useState } from 'react';
import { Plus, Loader2, Trash2, StopCircle, Cpu, HardDrive, Database } from 'lucide-react';
import { CreateServerModal } from './CreateServerModal';

interface DashboardProps {
    onServerSelect: (serverId: string) => void;
}

export function Dashboard({ onServerSelect }: DashboardProps) {
    const [servers, setServers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    const fetchServers = async () => {
        try {
            const res = await fetch('/api/servers');
            const data = await res.json();
            setServers(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServers();

        // Auto-refresh slightly to see when downloads finish
        const interval = setInterval(fetchServers, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleDelete = async (serverId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm("Sei sicuro di voler eliminare questo server? Tutti i file andranno persi.")) return;
        try {
            await fetch(`/api/servers/${serverId}`, { method: 'DELETE' });
            fetchServers();
        } catch (err) {
            console.error(err);
        }
    };

    const handleStop = async (serverId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await fetch(`/api/servers/${serverId}/stop`, { method: 'POST' });
            // Let the polling update the status
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
            {/* Top Navigation */}
            <div className="top-header" style={{ padding: '0 40px', justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className="sidebar-logo" style={{ margin: 0 }}>
                        <span>MC</span> Manager <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '12px', letterSpacing: '1px' }}>ENTERPRISE</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }} onClick={() => setShowModal(true)}>
                        <Plus size={16} /> New Server
                    </button>
                </div>
            </div>

            {/* Dashboard Content */}
            <div className="page-container" style={{ flex: 1, padding: '40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <div className="header-title" style={{ fontSize: '24px' }}>Server Instances</div>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Loader2 className="spin" /></div>
                ) : servers.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No servers installed yet. Click "New Server" to begin!
                    </div>
                ) : (
                    <div className="dashboard-grid">
                        {servers.map((server) => {
                            const isDownloading = server.status === 'downloading';
                            const isError = server.status === 'error';
                            const isInteractable = !isDownloading && !isError;
                            return (
                                <div key={server.id} className="glass-panel server-card" onClick={() => isInteractable && onServerSelect(server.id)} style={{ cursor: isDownloading ? 'wait' : isInteractable ? 'pointer' : 'default' }}>
                                    <div className="card-header">
                                        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <Database size={24} style={{ color: isError ? '#ef4444' : isDownloading ? 'var(--text-muted)' : 'var(--accent)' }} />
                                            {server.name}
                                        </div>
                                        {isDownloading ? (
                                            <div className="status-badge" style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
                                                <Loader2 size={12} className="spin" /> Downloading...
                                            </div>
                                        ) : isError ? (
                                            <div className="status-badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                                                ⚠ Error
                                            </div>
                                        ) : (
                                            <div className={`status-badge ${server.running ? 'status-online' : 'status-offline'}`}>
                                                {server.running ? 'Online' : 'Offline'}
                                            </div>
                                        )}
                                    </div>

                                    <div className="card-meta">
                                        {server.type.charAt(0).toUpperCase() + server.type.slice(1)} {server.version}
                                    </div>

                                    {isError && server.error_message && (
                                        <div style={{ marginTop: '10px', padding: '10px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: '8px', borderLeft: '3px solid #ef4444' }}>
                                            <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600, marginBottom: '2px' }}>Download failed</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', wordBreak: 'break-word', maxHeight: '48px', overflow: 'hidden' }}>{server.error_message}</div>
                                        </div>
                                    )}

                                    {server.running && (
                                        <div style={{ display: 'flex', gap: '16px', marginTop: '12px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                                <Cpu size={14} />
                                                {server.cpu !== undefined ? `${server.cpu.toFixed(1)}%` : '--'}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                                <HardDrive size={14} />
                                                {server.ram !== undefined ? `${server.ram.toFixed(0)} MB` : '--'}
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <button className="btn-primary" style={{ flex: 1, padding: '8px' }} onClick={(e) => { e.stopPropagation(); onServerSelect(server.id); }} disabled={!isInteractable}>Open Workspace</button>
                                        {server.running && (
                                            <button className="btn-danger" style={{ padding: '8px 12px' }} title="Stop Server" onClick={(e) => handleStop(server.id, e)}>
                                                <StopCircle size={18} />
                                            </button>
                                        )}
                                        <button className="btn-danger" style={{ padding: '8px 12px' }} title="Delete Server" onClick={(e) => handleDelete(server.id, e)} disabled={isDownloading}>
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {showModal && (
                    <CreateServerModal
                        onClose={() => setShowModal(false)}
                        onServerCreated={() => {
                            setShowModal(false);
                            fetchServers();
                        }}
                    />
                )}
            </div>
        </div>
    );
}
