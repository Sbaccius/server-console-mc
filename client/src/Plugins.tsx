import { useState } from 'react';
import { Search, Download, Package } from 'lucide-react';

interface PluginsProps {
    serverId: string;
}

export function Plugins({ serverId }: PluginsProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [installing, setInstalling] = useState<Record<string, boolean>>({});

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        try {
            const res = await fetch(`/api/servers/${serverId}/addons/search?query=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data.hits) {
                setResults(data.hits);
            } else {
                setResults([]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleInstall = async (hit: any) => {
        if (hit.is_external && hit.external_url) {
            window.open(hit.external_url, '_blank');
            return;
        }

        setInstalling(prev => ({ ...prev, [hit.id]: true }));
        try {
            const res = await fetch(`/api/servers/${serverId}/addons/install`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_id: hit.id, provider: hit.provider })
            });
            const data = await res.json();
            if (res.ok) {
                alert(`Started downloading: ${data.filename}. It will appear in your File Manager shortly.`);
            } else {
                alert(`Error: ${data.detail}`);
            }
        } catch (e) {
            console.error(e);
            alert("Failed to request installation");
        } finally {
            setInstalling(prev => ({ ...prev, [hit.id]: false }));
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="top-header" style={{ padding: '0', background: 'transparent', borderBottom: 'none', height: '60px' }}>
                <div className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Package size={24} style={{ color: 'var(--accent)' }} />
                    Plugins & Mods Manager
                </div>
            </div>

            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', marginTop: '20px', marginBottom: '24px' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        className="input-field"
                        placeholder="Search for plugins or mods (eg. Essentials, Lithium...)"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        style={{ paddingLeft: '44px', width: '100%' }}
                    />
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? 'Searching...' : 'Search Addons'}
                </button>
            </form>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '8px' }}>
                {results.length === 0 && !loading && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' }}>
                        Search for plugins/mods above to see compatible results.
                        We automatically search Modrinth (for mods) or SpigotMC (for plugins).
                    </div>
                )}
                {results.map(hit => (
                    <div key={hit.id} className="card" style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', padding: '16px' }}>
                        {hit.icon_url ? (
                            <img src={hit.icon_url} alt={hit.title} style={{ width: '64px', height: '64px', borderRadius: '8px', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: '64px', height: '64px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Package size={32} color="var(--text-muted)" />
                            </div>
                        )}

                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                                {hit.title}
                            </div>
                            <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.4' }}>
                                {hit.description}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <span>Author: <b>{hit.author}</b></span>
                                <span>Downloads: <b>{Number(hit.downloads).toLocaleString()}</b></span>
                                <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                                    via {hit.provider}
                                </span>
                            </div>
                        </div>

                        <button
                            className={hit.is_external ? "btn-secondary" : "btn-primary"}
                            onClick={() => handleInstall(hit)}
                            disabled={installing[hit.id]}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', whiteSpace: 'nowrap' }}
                        >
                            <Download size={16} />
                            {hit.is_external
                                ? 'External Link'
                                : (installing[hit.id] ? 'Installing...' : 'Install')
                            }
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
