import { useState, useEffect } from 'react';
import { Wifi, Globe, Server, Info, ExternalLink, Loader2, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface NetworkStatus {
    local_ip: string;
    external_ip: string;
    upnp_available: boolean;
}

export function Network({ serverId }: { serverId: string }) {
    const [status, setStatus] = useState<NetworkStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [mapping, setMapping] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const fetchStatus = async () => {
        try {
            const res = await fetch(`/api/servers/${serverId}/network`);
            const data = await res.json();
            setStatus(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, [serverId]);

    const handleUPnP = async () => {
        setMapping(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/servers/${serverId}/network/upnp`, { method: 'POST' });
            const data = await res.json();
            if (data.status === 'success') {
                setMessage({ type: 'success', text: data.message });
            } else {
                setMessage({ type: 'error', text: data.message });
            }
        } catch (err) {
            setMessage({ type: 'error', text: "Failed to communicate with backend." });
        } finally {
            setMapping(false);
            fetchStatus();
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
                    <Wifi size={24} />
                    Network Exposure
                </h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
                    Configure how others can connect to your server. Use UPnP for automatic port forwarding or share your details manually.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                    {/* Local IP Card */}
                    <div style={{ padding: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)', marginBottom: '12px', fontSize: '14px' }}>
                            <Server size={18} />
                            Internal Network
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'monospace', marginBottom: '4px' }}>
                            {status?.local_ip}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Use this for connections on the same Wi-Fi</div>
                    </div>

                    {/* Public IP Card */}
                    <div style={{ padding: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)', marginBottom: '12px', fontSize: '14px' }}>
                            <Globe size={18} />
                            Public Access
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'monospace', marginBottom: '4px', color: status?.external_ip !== 'Unknown' ? 'var(--accent)' : 'var(--text-main)' }}>
                            {status?.external_ip}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Share this address with your friends</div>
                    </div>
                </div>

                <div style={{
                    padding: '32px',
                    background: 'rgba(19, 236, 109, 0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            background: 'var(--accent-glow)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            <RefreshCw size={20} style={{ color: 'var(--accent)' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ marginBottom: '8px' }}>Automatic Port Forwarding (UPnP)</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
                                UPnP allows the application to tell your router to open the Minecraft port automatically.
                                This is usually the easiest way to let others join.
                                <strong> Note:</strong> Your router must have UPnP enabled.
                            </p>

                            <button
                                className="btn-primary"
                                onClick={handleUPnP}
                                disabled={mapping}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                {mapping ? <Loader2 className="spin" size={18} /> : <ExternalLink size={18} />}
                                {mapping ? "Attempting Discovery..." : "Open Server to Public"}
                            </button>

                            {message && (
                                <div style={{
                                    marginTop: '20px',
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    background: message.type === 'success' ? 'rgba(19, 236, 109, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                    color: message.type === 'success' ? 'var(--accent)' : '#ef4444',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    fontSize: '14px',
                                    border: `1px solid ${message.type === 'success' ? 'var(--accent-glow)' : 'rgba(239, 68, 68, 0.2)'}`
                                }}>
                                    {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                                    {message.text}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: '32px', display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', color: 'var(--text-muted)', fontSize: '13px' }}>
                    <Info size={16} />
                    Is it not working? Make sure your router firewall isn't blocking the connection.
                </div>
            </div>
        </div>
    );
}
