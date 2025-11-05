import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-sky-400">404</h1>
        <p className="mt-4 text-xl text-slate-300">Page not found</p>
        <p className="mt-2 text-slate-400">
          The page you're looking for doesn't exist.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-lg bg-sky-500 px-6 py-3 font-medium text-white transition-colors hover:bg-sky-600"
        >
          Go back home
        </Link>
      </div>
    </div>
  );
}
