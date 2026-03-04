import { useState, useEffect } from 'react';
import { User, Shield, ShieldOff, UserX, Loader2 } from 'lucide-react';

interface Player {
    name: string;
    uuid: string;
    expiresOn: string;
}

export function Players({ serverId }: { serverId: string }) {
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPlayers = async () => {
        try {
            const res = await fetch(`/api/servers/${serverId}/players`);
            const data = await res.json();
            setPlayers(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlayers();
    }, [serverId]);

    const runCommand = async (cmd: string) => {
        await fetch(`/api/servers/${serverId}/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: cmd })
        });
        alert(`Command sent: ${cmd}`);
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
                    <User size={24} />
                    Player History
                </h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
                    View and manage players who have previously connected to this server.
                </p>

                {players.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                        No players found in cache.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                        {players.map(p => (
                            <div key={p.uuid} className="card" style={{
                                padding: '16px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px'
                            }}>
                                <img
                                    src={`https://crafatar.com/avatars/${p.uuid}?size=48&overlay`}
                                    alt={p.name}
                                    style={{ borderRadius: '4px', width: '48px', height: '48px' }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.uuid.slice(0, 13)}...</div>
                                </div>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button
                                        className="btn-icon"
                                        title="Make Operator"
                                        onClick={() => runCommand(`op ${p.name}`)}
                                        style={{ padding: '6px', background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}
                                    >
                                        <Shield size={16} />
                                    </button>
                                    <button
                                        className="btn-icon"
                                        title="Kick Player"
                                        onClick={() => runCommand(`kick ${p.name}`)}
                                        style={{ padding: '6px', background: 'transparent', border: 'none', color: '#f59e0b', cursor: 'pointer' }}
                                    >
                                        <UserX size={16} />
                                    </button>
                                    <button
                                        className="btn-icon"
                                        title="Ban Player"
                                        onClick={() => runCommand(`ban ${p.name}`)}
                                        style={{ padding: '6px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                    >
                                        <ShieldOff size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
