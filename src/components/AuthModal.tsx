import React from 'react';
import { X, UserCheck, Shield, Trash2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  } | null;
  onRefreshBootstrap: () => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onRefreshBootstrap,
}) => {
  const [mode, setMode] = React.useState<'login' | 'register' | 'recover'>(
    currentUser ? 'login' : 'register'
  );
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        await onRefreshBootstrap();
        onClose();
      } else if (mode === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, fullName }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');
        await onRefreshBootstrap();
        onClose();
      } else {
        const res = await fetch('/api/auth/recover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, newPassword: password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Recovery failed');
        setMessage(data.message || 'Password updated. You can now sign in.');
        setMode('login');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/account', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Account deletion failed');
      await onRefreshBootstrap();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to sign out');
      await onRefreshBootstrap();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-lg bg-white border border-stone-200 rounded-lg p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-stone-200 pb-4">
          <h2 id="auth-modal-title" className="text-lg font-bold text-stone-900">
            {currentUser ? 'Account Settings' : 'Sign In or Create Your Account'}
          </h2>
          <div className="flex items-center gap-2">
            {currentUser && (
              <button
                type="button"
                disabled={loading}
                onClick={handleLogout}
                className="px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors"
              >
                Sign Out
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Authentication Modal"
              className="p-1.5 text-stone-500 hover:text-stone-900 rounded-md border border-stone-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
              mode === 'login' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
              mode === 'register' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Create Student Account
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('recover');
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
              mode === 'recover' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Password Recovery
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label htmlFor="auth-fullname" className="block text-xs font-medium text-stone-700 mb-1">
                Full Name
              </label>
              <input
                id="auth-fullname"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Mei-Ling Chen"
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-md"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-medium text-stone-700 mb-1">
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@university.edu"
              className="w-full px-3 py-2 text-xs border border-stone-300 rounded-md"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-xs font-medium text-stone-700 mb-1">
              {mode === 'recover' ? 'New Password (min 8 chars)' : 'Password'}
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={mode === 'login' ? 1 : 8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-xs border border-stone-300 rounded-md"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {currentUser ? (
              <button
                type="button"
                onClick={handleDeleteAccount}
                className="inline-flex items-center gap-1.5 text-xs text-red-700 hover:underline"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Current Account & Private Data</span>
              </button>
            ) : (
              <span />
            )}

            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-md transition-colors"
            >
              {loading
                ? 'Processing…'
                : mode === 'login'
                ? 'Sign In'
                : mode === 'register'
                ? 'Register & Calculate Matches'
                : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
