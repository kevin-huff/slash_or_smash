import { Link } from 'react-router-dom';

export function NotFound(): JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-night-900 px-6 py-12 text-center text-bone-100">
      <p className="text-sm uppercase tracking-[0.4em] text-specter-300">404</p>
      <h1 className="text-4xl font-semibold text-status-locked">Page Not Found</h1>
      <p className="max-w-md text-base text-specter-300">
        This page doesn't exist. Ready to head back?
      </p>
      <Link className="rounded-full bg-status-ready px-6 py-2 font-medium text-night-900 shadow-lg transition hover:bg-status-ready/90" to="/">
        Return to Home
      </Link>
    </main>
  );
}
