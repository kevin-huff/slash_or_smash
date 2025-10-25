import { Link } from 'react-router-dom';

export function Landing(): JSX.Element {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-night-900 p-8 text-center text-bone-100">
      <div className="max-w-xl space-y-4">
        <h1 className="text-3xl font-semibold tracking-wide text-witchlight-500 sm:text-4xl">
          Slash or Smash
        </h1>
        <p className="text-lg text-specter-300">
          Interactive rating game for live streams - judges rate content in real-time with dynamic overlays.
        </p>
      </div>
      <nav className="flex flex-wrap justify-center gap-4 text-base">
        <Link className="rounded-full bg-witchlight-500 px-6 py-2 font-medium text-night-900 shadow-lg transition hover:bg-witchlight-500/90" to="/control">
          Producer Control
        </Link>
        <Link className="rounded-full border border-specter-300/40 px-6 py-2 font-medium transition hover:border-specter-300/80" to="/judge">
          Judge Console
        </Link>
        <Link className="rounded-full border border-status-results/60 bg-status-results/10 px-6 py-2 font-medium text-status-results transition hover:border-status-results hover:bg-status-results/20" to="/leaderboard">
          Leaderboard
        </Link>
        <Link className="rounded-full border border-status-ready/60 px-6 py-2 font-medium transition hover:border-status-ready" to="/overlay">
          Live Overlay
        </Link>
        <Link className="rounded-full border border-status-results/40 px-6 py-2 font-medium text-specter-300 transition hover:border-status-results/60" to="/overlay/leaderboard">
          Leaderboard Overlay
        </Link>
      </nav>
    </main>
  );
}
