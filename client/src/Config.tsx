import { useState, useEffect } from 'react';
import { Settings, Save, Server as ServerIcon } from 'lucide-react';

interface ConfigProps {
    serverId: string;
}

export function Config({ serverId }: ConfigProps) {
    const [properties, setProperties] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [javaProvider, setJavaProvider] = useState('system');
    const [ramMb, setRamMb] = useState(1024);
    const [savingRam, setSavingRam] = useState(false);

    useEffect(() => {
        async function fetchConfig() {
            setLoading(true);
            try {
                // Load server.properties
                const configRes = await fetch(`/api/servers/${serverId}/config`);
                const configData = await configRes.json();
                setProperties(configData.properties || {});

                // Load java_provider from server list
                const serversRes = await fetch('/api/servers');
                const serversData = await serversRes.json();
                const srv = serversData.find((s: any) => s.id === serverId);
                if (srv) {
                    setJavaProvider(srv.java_provider || 'system');
                    setRamMb(srv.ram_mb || 1024);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        fetchConfig();
    }, [serverId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetch(`/api/servers/${serverId}/config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(properties)
            });
            alert('Configuration saved!');
        } catch (e) {
            console.error(e);
            alert('Failed to save properties.');
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (key: string, value: string) => {
        setProperties(prev => ({ ...prev, [key]: value }));
    };

    const handleRamSave = async () => {
        setSavingRam(true);
        try {
            await fetch(`/api/servers/${serverId}/config/ram`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ram_mb: ramMb })
            });
        } catch (e) { console.error(e); }
        finally { setSavingRam(false); }
    };

    const handleJavaChange = async (newProvider: string) => {
        setJavaProvider(newProvider);
        try {
            await fetch(`/api/servers/${serverId}/config/java`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ java_provider: newProvider })
            });
        } catch (e) { console.error(e); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="top-header" style={{ padding: '0', background: 'transparent', borderBottom: 'none', height: '60px' }}>
                <div className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Settings size={24} style={{ color: 'var(--accent)' }} />
                    Configuration ({serverId})
                </div>

                <button className="btn-primary" onClick={handleSave} disabled={saving || loading} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            <div className="page-container" style={{ padding: '20px 0' }}>
                <div className="glass-panel" style={{ padding: '24px', marginBottom: '20px' }}>
                    <h3 style={{ marginTop: 0 }}>Java Runtime</h3>
                    <select
                        value={javaProvider}
                        onChange={(e) => handleJavaChange(e.target.value)}
                        className="input-field"
                        style={{ width: '100%' }}
                    >
                        <option value="system">System Default</option>
                        <option value="adoptium">Adoptium (Eclipse Temurin)</option>
                        <option value="corretto">Amazon Corretto</option>
                        <option value="openjdk">Microsoft OpenJDK</option>
                    </select>
                </div>

                <div className="glass-panel" style={{ padding: '24px', marginBottom: '20px' }}>
                    <h3 style={{ marginTop: 0 }}>RAM Allocation</h3>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>
                        Memory
                        <span style={{ float: 'right', color: 'var(--accent)', fontWeight: 600 }}>{ramMb} MB ({(ramMb / 1024).toFixed(1)} GB)</span>
                    </label>
                    <input
                        type="range"
                        min={512}
                        max={16384}
                        step={256}
                        value={ramMb}
                        onChange={e => setRamMb(Number(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', marginBottom: '8px' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                        <input
                            type="number"
                            min={512}
                            max={16384}
                            step={256}
                            value={ramMb}
                            onChange={e => setRamMb(Math.min(16384, Math.max(512, Number(e.target.value))))}
                            className="input-field"
                            style={{ width: '120px' }}
                        />
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>MB</span>
                        <button
                            className="btn-primary"
                            onClick={handleRamSave}
                            disabled={savingRam}
                            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            <Save size={14} /> {savingRam ? 'Saving...' : 'Save RAM'}
                        </button>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', marginBottom: 0 }}>
                        ⚠ Changes apply on next server start.
                    </p>
                </div>

                {loading ? (
                    <div style={{ padding: '20px' }}>Loading properties...</div>
                ) : Object.keys(properties).length === 0 ? (
                    <div style={{ padding: '20px', color: 'var(--text-muted)' }}>
                        <ServerIcon size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
                        <br />
                        No server.properties found. It will be generated when you run the server for the first time.
                    </div>
                ) : (
                    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {Object.entries(properties).map(([key, val]) => (
                            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <label style={{ fontSize: '14px', color: 'var(--text-muted)', flex: 1 }}>{key}</label>
                                {val === 'true' || val === 'false' ? (
                                    <div style={{ flex: 2, display: 'flex', alignItems: 'center' }}>
                                        <label className="switch">
                                            <input
                                                type="checkbox"
                                                checked={val === 'true'}
                                                onChange={e => handleChange(key, e.target.checked ? 'true' : 'false')}
                                            />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                ) : (
                                    <input
                                        type="text"
                                        className="input-field"
                                        style={{ flex: 2 }}
                                        value={val}
                                        onChange={e => handleChange(key, e.target.value)}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
