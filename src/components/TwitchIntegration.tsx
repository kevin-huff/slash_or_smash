import { useEffect, useState } from 'react';
import { connectTwitch, disconnectTwitch, getTwitchStatus, toggleTwitchPredictions, type TwitchStatus } from '../api/twitch';
import { reconnectAudience } from '../api/control';

export function TwitchIntegration() {
  const [status, setStatus] = useState<TwitchStatus | null>({ connected: false, configured: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTwitchStatus();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Twitch status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleConnect = () => {
    connectTwitch();
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect from Twitch? This will disable predictions.')) {
      return;
    }

    try {
      setLoading(true);
      await disconnectTwitch();
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (enabled: boolean) => {
    try {
      setLoading(true);
      await toggleTwitchPredictions(enabled);
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle predictions');
    } finally {
      setLoading(false);
    }
  };

  const handleReconnectChat = async () => {
    if (!confirm('Force reconnect Twitch chat listener? This may interrupt active voting.')) {
      return;
    }

    try {
      setLoading(true);
      await reconnectAudience();
      // Wait a moment for connection to re-establish
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reconnect chat');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !status) {
    return (
      <div className="rounded-xl border border-white/10 bg-night-900/60 p-6">
        <h3 className="mb-4 text-lg font-semibold text-bone-100">Twitch Integration</h3>
        <p className="text-sm text-specter-300">Loading...</p>
      </div>
    );
  }

  if (!status?.configured) {
    return (
      <div className="rounded-xl border border-white/10 bg-night-900/60 p-6">
        <h3 className="mb-4 text-lg font-semibold text-bone-100">Twitch Integration</h3>
        <p className="mb-4 text-sm text-specter-300">
          Twitch integration is not configured. Add TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET to your environment
          variables.
        </p>
        <a
          href="https://dev.twitch.tv/console/apps"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-status-voting hover:underline"
        >
          Create a Twitch app →
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-night-900/60 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-bone-100">Twitch Integration</h3>
        <div className="flex items-center gap-2">
          {status.connected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-status-voting/10 px-3 py-1 text-xs font-medium text-status-voting">
              <span className="h-1.5 w-1.5 rounded-full bg-status-voting" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-specter-700/30 px-3 py-1 text-xs font-medium text-specter-300">
              <span className="h-1.5 w-1.5 rounded-full bg-specter-500" />
              Disconnected
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-status-results/20 bg-status-results/5 p-3 text-sm text-status-results">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {!status.connected ? (
          <>
            <p className="text-sm text-specter-300">
              Connect your Twitch account to enable automatic predictions during voting rounds.
            </p>
            <button
              onClick={handleConnect}
              disabled={loading}
              className="rounded-lg bg-[#9146FF] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#772CE8] disabled:opacity-50"
            >
              Connect Twitch Account
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-night-950/40 p-4">
              <div>
                <p className="text-sm font-medium text-bone-100">Automatic Predictions</p>
                <p className="mt-1 text-xs text-specter-400">
                  Auto-create and resolve predictions during rounds (Smash ≥ 2.5 vs Slash &lt; 2.5)
                </p>
              </div>
              <button
                onClick={() => handleToggle(!status.enabled)}
                disabled={loading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${status.enabled ? 'bg-status-voting' : 'bg-specter-700'
                  }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${status.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
              </button>
            </div>

            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="text-sm text-specter-400 transition hover:text-specter-200 disabled:opacity-50"
            >
              Disconnect Twitch
            </button>
          </>
        )}

        <div className="border-t border-white/10 pt-4">
          <button
            onClick={handleReconnectChat}
            disabled={loading}
            className="text-xs text-specter-400 transition hover:text-specter-200 disabled:opacity-50"
          >
            Force Reconnect Chat Listener
          </button>
        </div>
      </div>
    </div>
  );
}
