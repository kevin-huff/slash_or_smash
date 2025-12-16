import { Link } from 'react-router-dom';

export function NotFound(): JSX.Element {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden bg-[#0e1c14] px-6 py-12 text-center text-bone-100">
      <div className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: "url('/images/snowfall.svg')" }} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0c1a14] via-[#0f241b] to-[#0b1712]" />
      <div className="relative z-10 flex flex-col items-center gap-5">
        <p className="text-sm uppercase tracking-[0.4em] text-frost">404</p>
        <h1 className="text-4xl font-semibold text-gold">Lost in the Snow</h1>
        <p className="max-w-md text-base text-frost">
          Looks like you wandered off the trail. Ready to head back to the workshop?
        </p>
        <Link className="rounded-full bg-gradient-to-r from-[#d64545] to-[#f7d774] px-6 py-2 font-semibold text-[#0b1712] shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5" to="/">
          Return to Home
        </Link>
      </div>
    </main>
  );
}
