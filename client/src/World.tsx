import { useState, useEffect } from 'react';
import { Globe, Trash2, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';

interface WorldInfo {
    name: string;
    size_mb: number;
    path: string;
}

export function World({ serverId }: { serverId: string }) {
    const [info, setInfo] = useState<WorldInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [resetting, setResetting] = useState(false);

    const fetchInfo = async () => {
        try {
            const res = await fetch(`/api/servers/${serverId}/world`);
            const data = await res.json();
            setInfo(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInfo();
    }, [serverId]);

    const handleReset = async () => {
        if (!confirm("Are you ABSOLUTELY sure? This will permanently delete all world data (buildings, player inventories, etc.). This cannot be undone.")) {
            return;
        }

        setResetting(true);
        try {
            const res = await fetch(`/api/servers/${serverId}/world/reset`, { method: 'POST' });
            const data = await res.json();
            alert(data.message);
            fetchInfo();
        } catch (err) {
            alert("Failed to reset world.");
        } finally {
            setResetting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Loader2 className="spin" size={32} />
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="glass-panel">
                <h2 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Globe size={24} />
                    World Management
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                    <div className="stat-card" style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '8px' }}>World Name</div>
                        <div style={{ fontSize: '20px', fontWeight: 600 }}>{info?.name}</div>
                    </div>
                    <div className="stat-card" style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '8px' }}>Disk Usage</div>
                        <div style={{ fontSize: '20px', fontWeight: 600 }}>{info?.size_mb} MB</div>
                    </div>
                </div>

                <div style={{
                    padding: '24px',
                    background: 'rgba(239, 68, 68, 0.05)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '8px',
                    marginTop: '24px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#ef4444', marginBottom: '12px', fontWeight: 600 }}>
                        <AlertTriangle size={20} />
                        Danger Zone
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
                        Resetting the world will wipe all map data. Make sure you have a backup if you want to keep your progress. The server will be restarted if it is currently running.
                    </p>
                    <button
                        className="btn-danger"
                        onClick={handleReset}
                        disabled={resetting}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        {resetting ? <RefreshCw className="spin" size={16} /> : <Trash2 size={16} />}
                        Reset World
                    </button>
                </div>
            </div>
        </div>
    );
}
