'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-red-400">Error</h1>
        <p className="mt-4 text-xl text-slate-300">Something went wrong!</p>
        <p className="mt-2 text-slate-400">
          {error.message || 'An unexpected error occurred'}
        </p>
        <button
          onClick={() => reset()}
          className="mt-8 inline-block rounded-lg bg-sky-500 px-6 py-3 font-medium text-white transition-colors hover:bg-sky-600"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
