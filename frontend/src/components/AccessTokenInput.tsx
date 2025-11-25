import { useState, useEffect } from 'react';
import { Key, Save, CheckCircle } from 'lucide-react';
import { API_URL } from '../config/api';

export function AccessTokenInput() {
    const [token, setToken] = useState('');
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(false);

    // Load token from backend on mount
    useEffect(() => {
        fetchToken();
    }, []);

    const fetchToken = async () => {
        try {
            const res = await fetch(`${API_URL}/api/access-token`);
            if (res.ok) {
                const data = await res.json();
                setToken(data.token);
                // Cache in localStorage
                localStorage.setItem('dhan_access_token', data.token);
                setSaved(true);
            }
        } catch (error) {
            console.log('No token stored in backend');
        }
    };

    const saveToken = async () => {
        if (!token.trim()) return;

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/access-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token.trim() })
            });

            if (res.ok) {
                localStorage.setItem('dhan_access_token', token.trim());
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
                console.log('✅ Access token saved');
            } else {
                const data = await res.json();
                console.error('Failed to save token:', data.error);
                alert('Failed to save token: ' + data.error);
            }
        } catch (error) {
            console.error('Failed to save token:', error);
            alert('Failed to save token. Check console for details.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 flex-1">
                    <Key className="w-5 h-5 text-gray-400" />
                    <input
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="Enter Dhan Access Token (for order placement)"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    />
                </div>
                <button
                    onClick={saveToken}
                    disabled={loading || !token.trim()}
                    className={`px-6 py-2 rounded-lg flex items-center gap-2 transition-colors ${saved
                        ? 'bg-green-600 text-white'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                        } disabled:bg-gray-300 disabled:cursor-not-allowed`}
                >
                    {saved ? (
                        <>
                            <CheckCircle className="w-4 h-4" />
                            Saved
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            {loading ? 'Saving...' : 'Save Token'}
                        </>
                    )}
                </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
                Access token is required for order placement. Get it from Dhan API settings at{' '}
                <a
                    href="https://web.dhan.co/api-dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                >
                    Dhan API Dashboard
                </a>
            </p>
        </div>
    );
}
