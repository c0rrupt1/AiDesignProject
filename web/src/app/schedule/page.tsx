import type { Metadata } from "next";

const bookingEmbedUrl = process.env.NEXT_PUBLIC_ZOHO_BOOKINGS_IFRAME_SRC;

export const metadata: Metadata = {
  title: "Schedule a Service",
  description:
    "Pick a staffed appointment slot and automatically create a work order.",
};

export default function SchedulePage() {
  return (
    <main className="flex min-h-screen w-full justify-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex w-full max-w-5xl flex-col gap-8">
        <header className="max-w-2xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Book a visit
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-4xl">
            Schedule a service appointment
          </h1>
          <p className="text-base text-neutral-600 dark:text-neutral-300">
            Choose the time that works for you. We only display slots when a
            technician is on shift, so the appointment you book will be staffed.
          </p>
        </header>
        <section className="w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <div className="aspect-[4/5] w-full">
            {bookingEmbedUrl ? (
              <iframe
                src={bookingEmbedUrl}
                title="Book a service appointment"
                className="h-full w-full"
                allow="payment *; geolocation *"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 bg-neutral-50 text-center text-sm text-neutral-500 dark:bg-neutral-900 dark:text-neutral-300">
                <p className="max-w-md">
                  Add your Zoho Bookings iframe URL to the
                  <code className="mx-1 rounded bg-neutral-200 px-1 py-0.5 text-xs font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-100">
                    NEXT_PUBLIC_ZOHO_BOOKINGS_IFRAME_SRC
                  </code>
                  environment variable to display the booking calendar here.
                </p>
                <p className="text-xs text-neutral-400">
                  Zoho Bookings → Share → Embed as widget → copy the iframe URL.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
