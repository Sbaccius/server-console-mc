import { useState, useEffect } from 'react';
import { Folder, ArrowLeft, Loader2, FileCode, Trash2, Edit, Save } from 'lucide-react';

interface FileItem {
    name: string;
    is_dir: boolean;
    size: number;
    mtime: number;
}

interface FileManagerProps {
    serverId: string;
}

export function FileManager({ serverId }: FileManagerProps) {
    const [path, setPath] = useState('.');
    const [files, setFiles] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingFile, setEditingFile] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchFiles();
    }, [path, serverId]);

    const fetchFiles = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/servers/${serverId}/files?path=${path}`);
            if (res.ok) {
                const data = await res.json();
                setFiles(data.sort((a: FileItem, b: FileItem) => {
                    if (a.is_dir === b.is_dir) return a.name.localeCompare(b.name);
                    return a.is_dir ? -1 : 1;
                }));
            }
        } catch (error) {
            console.error('Error fetching files:', error);
        }
        setLoading(false);
    };

    const handleNavigate = (dirName: string) => {
        if (dirName === '..') {
            const parts = path.split('/');
            parts.pop();
            setPath(parts.join('/') || '.');
        } else {
            setPath(path === '.' ? dirName : `${path}/${dirName}`);
        }
    };

    const handleEdit = async (fileName: string) => {
        const filePath = path === '.' ? fileName : `${path}/${fileName}`;
        try {
            const res = await fetch(`/api/servers/${serverId}/files/content?path=${filePath}`);
            if (res.ok) {
                const data = await res.json();
                setEditingFile(filePath);
                setEditContent(data.content);
            }
        } catch (error) {
            alert('Failed to load file content');
        }
    };

    const handleSave = async () => {
        if (!editingFile) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/servers/${serverId}/files/content?path=${editingFile}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: editContent })
            });
            if (res.ok) {
                setEditingFile(null);
            } else {
                alert('Failed to save file');
            }
        } catch (error) {
            alert('Error saving file');
        }
        setSaving(false);
    };

    const handleDelete = async (fileName: string) => {
        if (!confirm(`Are you sure you want to delete ${fileName}?`)) return;
        const filePath = path === '.' ? fileName : `${path}/${fileName}`;
        try {
            const res = await fetch(`/api/servers/${serverId}/files?path=${filePath}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchFiles();
            } else {
                alert('Failed to delete');
            }
        } catch (error) {
            alert('Error deleting');
        }
    };

    if (editingFile) {
        return (
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button className="btn-icon" onClick={() => setEditingFile(null)}><ArrowLeft size={18} /></button>
                        <h3 style={{ margin: 0 }}>Editing {editingFile}</h3>
                    </div>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 size={18} className="spin" /> : <Save size={18} />}
                        Save Changes
                    </button>
                </div>
                <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    style={{
                        flex: 1,
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontFamily: 'monospace',
                        padding: '16px',
                        resize: 'none',
                        outline: 'none'
                    }}
                />
            </div>
        );
    }

    return (
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Folder size={24} color="var(--accent)" />
                    <h2 style={{ margin: 0 }}>File Manager</h2>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>{path}</span>
                </div>
                <button className="btn-icon" onClick={fetchFiles}><Loader2 size={18} className={loading ? 'spin' : ''} /></button>
            </div>

            <div className="file-list" style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                {path !== '.' && (
                    <div className="file-item" onClick={() => handleNavigate('..')} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <ArrowLeft size={18} />
                        <span>..</span>
                    </div>
                )}
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}><Loader2 className="spin" /></div>
                ) : files.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>This directory is empty</div>
                ) : (
                    files.map((file) => (
                        <div key={file.name} className="file-item" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div
                                style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: file.is_dir ? 'pointer' : 'default', flex: 1 }}
                                onClick={() => file.is_dir && handleNavigate(file.name)}
                            >
                                {file.is_dir ? <Folder size={18} color="var(--accent)" /> : <FileCode size={18} color="var(--text-muted)" />}
                                <span>{file.name}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {!file.is_dir && (
                                    <button className="btn-icon" title="Edit" onClick={() => handleEdit(file.name)}><Edit size={16} /></button>
                                )}
                                <button className="btn-icon" title="Delete" style={{ color: '#ef4444' }} onClick={() => handleDelete(file.name)}><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
