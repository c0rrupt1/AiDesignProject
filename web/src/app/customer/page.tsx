import type { Metadata } from "next";
import { CustomerPortal } from "@/components/customer/CustomerPortal";

export const metadata: Metadata = {
  title: "Customer Portal | deckd studio",
  description:
    "Upload reference photos, request project quotes, and review invoices for your deckd interior makeovers.",
};

// Force dynamic rendering since this page uses authentication context
export const dynamic = 'force-dynamic';

export default function CustomerPortalPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(56,189,248,0.1),_transparent_60%)]" />
      <div className="pointer-events-none absolute -top-56 left-1/2 -z-10 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-amber-400/25 blur-[150px]" />
      <main className="mx-auto max-w-4xl px-6 pb-24 pt-16 md:px-10">
        <CustomerPortal />
      </main>
    </div>
  );
}
