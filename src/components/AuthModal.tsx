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
  availableAccounts: Array<{
    id: string;
    email: string;
    fullName: string;
    role: string;
  }>;
  onRefreshBootstrap: () => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  availableAccounts,
  onRefreshBootstrap,
}) => {
  const [mode, setMode] = React.useState<'login' | 'register' | 'recover'>('login');
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

  const handleSwitchAccount = async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/switch-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error('Failed to switch user session');
      await onRefreshBootstrap();
      onClose();
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-lg p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <h2 id="auth-modal-title" className="text-lg font-bold text-slate-900">
            Account Authentication & Multi-User Isolation
          </h2>
          <div className="flex items-center gap-2">
            {currentUser && (
              <button
                type="button"
                disabled={loading}
                onClick={handleLogout}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              >
                Sign Out
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Authentication Modal"
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md border border-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Instant Multi-User Session Switcher for testing row-level data isolation */}
        {availableAccounts.length > 0 && (
          <div className="space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="text-xs font-semibold text-slate-800">
              Active Workspace Accounts (Row-Level Data Isolation)
            </div>
            <p className="text-[11px] text-slate-600">
              Switch accounts to verify that profiles, GPA scales, saved opportunities, tasks, and notifications are strictly isolated per user while sharing the verified opportunity database:
            </p>
            <div className="space-y-1.5 pt-1">
              {availableAccounts.map((acc) => {
                const isCurrent = currentUser?.id === acc.id;
                return (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between gap-2 bg-white border border-slate-200 px-3 py-2 rounded text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-900">{acc.fullName}</span>
                      <span className="text-slate-500"> · {acc.email} · Role: {acc.role}</span>
                    </div>
                    <button
                      type="button"
                      disabled={isCurrent || loading}
                      onClick={() => handleSwitchAccount(acc.id)}
                      className={`px-2.5 py-1 rounded text-xs font-medium ${
                        isCurrent
                          ? 'bg-slate-100 text-slate-500 cursor-default'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      {isCurrent ? 'Active Session' : 'Switch to Account'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
              mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
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
              mode === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
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
              mode === 'recover' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
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
              <label htmlFor="auth-fullname" className="block text-xs font-medium text-slate-700 mb-1">
                Full Name
              </label>
              <input
                id="auth-fullname"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Mei-Ling Chen"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-medium text-slate-700 mb-1">
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@university.edu"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-xs font-medium text-slate-700 mb-1">
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
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {currentUser && availableAccounts.length > 1 ? (
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
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
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
