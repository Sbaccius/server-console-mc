import { useState, useEffect, useRef } from 'react';
import { Terminal, Play, Square, Send } from 'lucide-react';

interface ConsoleProps {
    serverId: string;
}

export function Console({ serverId }: ConsoleProps) {
    const [logs, setLogs] = useState<string[]>([]);
    const [inputLines, setInputLines] = useState('');
    const [commandHistory, setCommandHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [isRunning, setIsRunning] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);

    // Clear logs when serverId changes
    useEffect(() => {
        setLogs([]);
    }, [serverId]);

    useEffect(() => {
        // Scroll to bottom when logs change
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    useEffect(() => {
        let ws: WebSocket;
        let reconnectTimeout: ReturnType<typeof setTimeout>;
        let isUnmounted = false;

        const connect = () => {
            if (isUnmounted) return;
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws = new WebSocket(`${protocol}//${window.location.host}/api/servers/${serverId}/logs`);

            ws.onopen = () => {
                if (isUnmounted) {
                    ws.close();
                    return;
                }
                // Clear the logs completely on a fresh connection so we don't duplicate history
                setLogs([`[System] Connected to log stream for ${serverId}.`]);
            };

            ws.onmessage = (event) => {
                setLogs(prev => {
                    // Quick check to avoid duplicating the exact same consecutive message (sometimes happens during rapid reconnects)
                    if (prev.length > 0 && prev[prev.length - 1] === event.data) return prev;
                    return [...prev, event.data];
                });

                // heuristics to determine run state dynamically from logs 
                if (event.data.includes('Done') || event.data.includes('Starting')) {
                    setIsRunning(true);
                } else if (event.data.includes('Stopping server') || event.data.includes('Saving chunks for level')) {
                    setIsRunning(false);
                }
            };

            ws.onclose = () => {
                if (!isUnmounted) {
                    setLogs(prev => [...prev, '[System] Disconnected from log stream. Retrying...']);
                    reconnectTimeout = setTimeout(connect, 3000);
                }
            };

            ws.onerror = () => {
                // Let onclose handle it
            };
        };

        connect();

        // Check initial status
        fetch('/api/servers')
            .then(res => res.json())
            .then((data: any[]) => {
                if (isUnmounted) return;
                const srv = data.find((s: any) => s.id === serverId);
                if (srv) {
                    setIsRunning(srv.running);
                }
            });

        return () => {
            isUnmounted = true;
            clearTimeout(reconnectTimeout);
            if (ws) {
                // Prevent onclose from firing and trying to reconnect
                ws.onclose = null;
                ws.close();
            }
        };
    }, [serverId]);

    const handleStart = async () => {
        try {
            const res = await fetch(`/api/servers/${serverId}/start`, { method: 'POST' });
            if (res.ok) {
                setIsRunning(true);
            } else {
                const d = await res.json();
                alert(d.detail || 'Failed to start');
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleStop = async () => {
        try {
            const res = await fetch(`/api/servers/${serverId}/stop`, { method: 'POST' });
            if (res.ok) {
                // Don't auto-set running to false yet, wait for logs to stop it
            }
        } catch (e) {
            console.error(e);
        }
    };


    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        const cmd = inputLines.trim();
        if (!cmd) return;

        try {
            await fetch(`/api/servers/${serverId}/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: cmd })
            });
            setCommandHistory(prev => [...prev, cmd]);
            setHistoryIndex(-1);
            setInputLines('');
        } catch (e) {
            console.error(e);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (commandHistory.length > 0) {
                const newIndex = historyIndex === -1
                    ? commandHistory.length - 1
                    : Math.max(0, historyIndex - 1);
                setHistoryIndex(newIndex);
                setInputLines(commandHistory[newIndex]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex !== -1) {
                const newIndex = historyIndex + 1;
                if (newIndex >= commandHistory.length) {
                    setHistoryIndex(-1);
                    setInputLines('');
                } else {
                    setHistoryIndex(newIndex);
                    setInputLines(commandHistory[newIndex]);
                }
            }
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="top-header" style={{ padding: '0', background: 'transparent', borderBottom: 'none', height: '60px' }}>
                <div className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Terminal size={24} style={{ color: 'var(--accent)' }} />
                    Local Console
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                    {!isRunning ? (
                        <button className="btn-primary" onClick={handleStart} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Play size={16} /> Start Server
                        </button>
                    ) : (
                        <button className="btn-danger" onClick={handleStop} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Square size={16} /> Stop Server
                        </button>
                    )}
                </div>
            </div>

            <div className="console-window" style={{ flex: 1, marginTop: '20px' }}>
                {logs.map((log, index) => {
                    let className = 'log-line';
                    if (log.toLowerCase().includes('error') || log.toLowerCase().includes('exception')) className += ' error';
                    if (log.toLowerCase().includes('warn')) className += ' warn';
                    if (log.toLowerCase().includes('info')) className += ' info';

                    return (
                        <div key={index} className={className}>
                            {log}
                        </div>
                    );
                })}
                <div ref={endRef} />
            </div>

            <form onSubmit={handleSend} className="console-input-wrapper" style={{ marginTop: '20px' }}>
                <input
                    type="text"
                    className="input-field"
                    placeholder="Enter a server command (e.g., /gamemode survival @a)"
                    value={inputLines}
                    onChange={e => setInputLines(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!isRunning}
                />
                <button type="submit" className="btn-primary" style={{ padding: '12px 24px' }} disabled={!isRunning}>
                    <Send size={18} />
                </button>
            </form>
        </div>
    );
}
