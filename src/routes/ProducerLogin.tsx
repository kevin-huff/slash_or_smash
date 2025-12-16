import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkAuthStatus, login, setupPassword, type AuthStatus } from '../api/auth';

export function ProducerLogin(): JSX.Element {
  const navigate = useNavigate();
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const isSetupMode = authStatus?.passwordSet === false;

  useEffect(() => {
    async function checkStatus() {
      try {
        const status = await checkAuthStatus();
        setAuthStatus(status);

        // If already authenticated, redirect to control
        if (status.isAuthenticated) {
          navigate('/control', { replace: true });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to check auth status');
      } finally {
        setChecking(false);
      }
    }

    void checkStatus();
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSetupMode) {
        // Setup mode
        if (password.length < 4) {
          setError('Password must be at least 4 characters');
          setLoading(false);
          return;
        }

        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }

        await setupPassword(password);
      } else {
        // Login mode
        await login(password);
      }

      // Success - redirect to control
      navigate('/control', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0e1c14]">
        <div className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: "url('/images/snowfall.svg')" }} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0c1a14] via-[#0f241b] to-[#0b1712]" />
        <div className="relative z-10 text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent"></div>
          <p className="text-frost">Checking authentication...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0e1c14] px-6">
      <div className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: "url('/images/snowfall.svg')" }} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0c1a14] via-[#0f241b] to-[#0b1712]" />
      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-3xl border border-white/10 bg-grave-800/70 p-8 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-sm">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-semibold text-gold">
              {isSetupMode ? 'Set Password' : 'Producer Login'}
            </h1>
            <p className="mt-2 text-sm text-frost">
              {isSetupMode
                ? 'Create a password for the producer control dashboard'
                : 'Enter your password to access the control dashboard'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-bone-100">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/20 bg-night-900/70 px-4 py-3 text-bone-100 placeholder-frost/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
                placeholder={isSetupMode ? 'Choose a password' : 'Enter password'}
                required
                disabled={loading}
                autoFocus
              />
            </div>

            {isSetupMode && (
              <div>
                <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-bone-100">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-white/20 bg-night-900/70 px-4 py-3 text-bone-100 placeholder-frost/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30"
                placeholder="Confirm password"
                required
                disabled={loading}
              />
            </div>
            )}

            {error && (
              <div className="rounded-xl border border-status-results/40 bg-status-results/10 px-4 py-3 text-sm text-status-results">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-[#d64545] to-[#f7d774] px-6 py-3 font-semibold text-[#0b1712] shadow-[0_12px_40px_rgba(0,0,0,0.4)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-[#0e1c14] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Please wait...' : isSetupMode ? 'Set Password' : 'Login'}
            </button>
          </form>

          {isSetupMode && (
            <div className="mt-6 rounded-xl border border-status-voting/40 bg-status-voting/10 px-4 py-3 text-xs text-specter-300">
              <p className="font-semibold text-bone-100">First-time setup</p>
              <p className="mt-1">
                Choose a strong password. You'll need this password to access the producer control dashboard.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
