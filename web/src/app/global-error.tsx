'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
          <div className="text-center">
            <h1 className="text-6xl font-bold text-red-400">Error</h1>
            <p className="mt-4 text-xl text-slate-300">Something went wrong!</p>
            <button
              onClick={() => reset()}
              className="mt-8 inline-block rounded-lg bg-sky-500 px-6 py-3 font-medium text-white transition-colors hover:bg-sky-600"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
