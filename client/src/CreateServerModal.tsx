import React, { useState, useEffect } from 'react';
import { X, Server, DownloadCloud, Loader2 } from 'lucide-react';

interface Props {
    onClose: () => void;
    onServerCreated: () => void;
}

export function CreateServerModal({ onClose, onServerCreated }: Props) {
    const [name, setName] = useState('');
    const [type, setType] = useState('vanilla');
    const [versions, setVersions] = useState<string[]>([]);
    const [selectedVersion, setSelectedVersion] = useState('');
    const [javaProvider, setJavaProvider] = useState('system');
    const [ramMb, setRamMb] = useState(1024);
    const [loadingVersions, setLoadingVersions] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        async function fetchVersions() {
            setLoadingVersions(true);
            try {
                const res = await fetch(`/api/versions/${type}`);
                const data = await res.json();
                setVersions(data.slice(0, 50)); // cap to latest 50 for ui
                setSelectedVersion(data[0] || '');
            } catch (e) {
                console.error("Failed to load versions", e);
            } finally {
                setLoadingVersions(false);
            }
        }
        fetchVersions();
    }, [type]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !selectedVersion) return;
        setCreating(true);
        setError('');

        const serverId = name.toLowerCase().replace(/[^a-z0-9]/g, '-');

        try {
            const res = await fetch('/api/servers/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    server_id: serverId,
                    type,
                    version: selectedVersion,
                    java_provider: javaProvider,
                    ram_mb: ramMb
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || 'Creation failed');
            }

            onServerCreated();
        } catch (e: any) {
            setError(e.message);
            setCreating(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
            <div className="glass-panel" style={{ width: '450px', position: 'relative', opacity: creating ? 0.8 : 1, pointerEvents: creating ? 'none' : 'auto' }}>
                <button
                    disabled={creating}
                    onClick={onClose}
                    style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: creating ? 'not-allowed' : 'pointer' }}
                >
                    <X size={20} />
                </button>

                <h2 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Server size={24} style={{ color: 'var(--accent)' }} />
                    Create New Server
                </h2>

                {error && <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', marginBottom: '16px' }}>{error}</div>}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <fieldset disabled={creating} style={{ border: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>Server Name</label>
                            <input
                                required
                                type="text"
                                className="input-field"
                                placeholder="e.g. My Survival SMP"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>Software</label>
                            <select
                                className="input-field"
                                value={type}
                                onChange={e => setType(e.target.value)}
                                style={{ appearance: 'none' }}
                            >
                                <option value="vanilla">Vanilla</option>
                                <option value="purpur">Purpur (Optimized plugins)</option>
                                <option value="fabric">Fabric (Mods)</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>Version</label>
                            <select
                                required
                                className="input-field"
                                value={selectedVersion}
                                onChange={e => setSelectedVersion(e.target.value)}
                                disabled={loadingVersions}
                                style={{ appearance: 'none' }}
                            >
                                {loadingVersions ? (
                                    <option>Loading versions...</option>
                                ) : (
                                    versions.map(v => <option key={v} value={v}>{v}</option>)
                                )}
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>Java Version</label>
                            <select
                                className="input-field"
                                value={javaProvider}
                                onChange={e => setJavaProvider(e.target.value)}
                                style={{ appearance: 'none' }}
                            >
                                <option value="system">System Default (Pre-installed)</option>
                                <option value="corretto">Amazon Corretto 21 (AWS)</option>
                                <option value="adoptium">Adoptium Temurin 21 (Eclipse)</option>
                                <option value="openjdk">Microsoft OpenJDK 21</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>
                                RAM Allocation
                                <span style={{ float: 'right', color: 'var(--accent)', fontWeight: 600 }}>{ramMb} MB</span>
                            </label>
                            <input
                                type="range"
                                min={512}
                                max={16384}
                                step={256}
                                value={ramMb}
                                onChange={e => setRamMb(Number(e.target.value))}
                                style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                <span>512 MB</span>
                                <input
                                    type="number"
                                    min={512}
                                    max={16384}
                                    step={256}
                                    value={ramMb}
                                    onChange={e => setRamMb(Math.min(16384, Math.max(512, Number(e.target.value))))}
                                    className="input-field"
                                    style={{ width: '100px', padding: '2px 8px', fontSize: '12px', textAlign: 'center' }}
                                />
                                <span>16384 MB</span>
                            </div>
                        </div>
                    </fieldset>

                    <button type="submit" className="btn-primary" style={{ marginTop: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }} disabled={creating}>
                        {creating ? (
                            <><Loader2 size={18} className="spin" /> Creating Server...</>
                        ) : (
                            <><DownloadCloud size={18} /> Download & Create</>
                        )}
                    </button>
                    {creating && <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>Il server verrà aggiunto alla dashboard a breve.</p>}
                </form>
            </div>
        </div>
    );
}
