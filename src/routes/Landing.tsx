import { Link } from 'react-router-dom';

export function Landing(): JSX.Element {
  return (
    <main className="relative flex min-h-screen flex-1 flex-col items-center justify-center overflow-hidden bg-[#0e1c14] p-8 text-center text-bone-100">
      <div className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: "url('/images/snowfall.svg')" }} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0c1a14] via-[#0f241b] to-[#0b1712]" />
      <div className="pointer-events-none absolute inset-0 mix-blend-screen opacity-60 bg-[radial-gradient(70%_50%_at_25%_20%,rgba(200,55,70,0.18),rgba(10,24,16,0)),radial-gradient(65%_45%_at_75%_10%,rgba(247,215,116,0.2),rgba(10,24,16,0)),radial-gradient(90%_60%_at_50%_110%,rgba(34,120,78,0.3),rgba(10,24,16,0))]" />

      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="max-w-xl space-y-4">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.35em] text-frost">
            🎁 North Pole Edition
          </p>
          <h1 className="text-3xl font-semibold tracking-wide text-gold sm:text-4xl">
            Slash or Smash
          </h1>
          <p className="text-lg text-frost">
            Holiday stream game where judges unwrap every submission with real-time ratings and animated overlays.
          </p>
        </div>
        <nav className="flex flex-wrap justify-center gap-4 text-base">
          <Link className="rounded-full bg-gradient-to-r from-[#d64545] to-[#f7d774] px-6 py-2 font-semibold text-[#0b1712] shadow-[0_10px_40px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5" to="/control">
            Producer Control
          </Link>
          <Link className="rounded-full border border-white/15 bg-white/5 px-6 py-2 font-semibold text-bone-100 transition hover:-translate-y-0.5 hover:border-gold/70 hover:text-gold" to="/judge">
            Judge Console
          </Link>
          <Link className="rounded-full border border-gold/60 bg-gold/10 px-6 py-2 font-semibold text-gold transition hover:-translate-y-0.5 hover:border-gold hover:bg-gold/20" to="/leaderboard">
            Leaderboard
          </Link>
          <Link className="rounded-full border border-status-ready/60 px-6 py-2 font-semibold text-bone-100 transition hover:-translate-y-0.5 hover:border-status-ready hover:text-status-ready" to="/overlay">
            Live Overlay
          </Link>
          <Link className="rounded-full border border-white/15 bg-white/5 px-6 py-2 font-semibold text-frost transition hover:-translate-y-0.5 hover:border-gold/70 hover:text-gold" to="/overlay/leaderboard">
            Leaderboard Overlay
          </Link>
          <Link className="rounded-full border border-gold/60 bg-gold/10 px-6 py-2 font-semibold text-gold transition hover:-translate-y-0.5 hover:border-gold hover:bg-gold/20" to="/vote">
            Chat Vote Link
          </Link>
        </nav>
      </div>
    </main>
  );
}
