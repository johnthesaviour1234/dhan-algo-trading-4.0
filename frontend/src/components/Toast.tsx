import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

let toastIdCounter = 0;
const toastListeners: Set<(toasts: Toast[]) => void> = new Set();
let toasts: Toast[] = [];

function notifyListeners() {
    toastListeners.forEach(listener => listener([...toasts]));
}

export const toast = {
    success: (message: string) => {
        const id = `toast-${++toastIdCounter}`;
        toasts.push({ id, message, type: 'success' });
        notifyListeners();
        setTimeout(() => toast.dismiss(id), 4000);
    },
    error: (message: string) => {
        const id = `toast-${++toastIdCounter}`;
        toasts.push({ id, message, type: 'error' });
        notifyListeners();
        setTimeout(() => toast.dismiss(id), 5000);
    },
    warning: (message: string) => {
        const id = `toast-${++toastIdCounter}`;
        toasts.push({ id, message, type: 'warning' });
        notifyListeners();
        setTimeout(() => toast.dismiss(id), 4000);
    },
    info: (message: string) => {
        const id = `toast-${++toastIdCounter}`;
        toasts.push({ id, message, type: 'info' });
        notifyListeners();
        setTimeout(() => toast.dismiss(id), 4000);
    },
    dismiss: (id: string) => {
        toasts = toasts.filter(t => t.id !== id);
        notifyListeners();
    }
};

export function ToastContainer() {
    const [currentToasts, setCurrentToasts] = useState<Toast[]>([]);

    useEffect(() => {
        toastListeners.add(setCurrentToasts);
        return () => {
            toastListeners.delete(setCurrentToasts);
        };
    }, []);

    const getIcon = (type: ToastType) => {
        switch (type) {
            case 'success':
                return <CheckCircle className="w-5 h-5" />;
            case 'error':
                return <XCircle className="w-5 h-5" />;
            case 'warning':
            case 'info':
                return <AlertCircle className="w-5 h-5" />;
        }
    };

    const getColors = (type: ToastType) => {
        switch (type) {
            case 'success':
                return 'bg-green-50 text-green-800 border-green-200';
            case 'error':
                return 'bg-red-50 text-red-800 border-red-200';
            case 'warning':
                return 'bg-yellow-50 text-yellow-800 border-yellow-200';
            case 'info':
                return 'bg-blue-50 text-blue-800 border-blue-200';
        }
    };

    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
            {currentToasts.map((t) => (
                <div
                    key={t.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg animate-in slide-in-from-top-4 ${getColors(t.type)}`}
                >
                    {getIcon(t.type)}
                    <p className="flex-1 text-sm font-medium">{t.message}</p>
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="p-1 rounded hover:bg-black/10 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}
