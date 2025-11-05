import type { Metadata } from "next";
import { SupabaseAuthProvider } from "@/components/customer/SupabaseAuthProvider";
import { StaffDashboard } from "@/components/crm/StaffDashboard";

export const metadata: Metadata = {
  title: "CRM Dashboard | deckd studio",
  description:
    "Internal deckd workspace for reviewing customer quotes, managing uploads, and issuing invoices.",
};

export default function CrmDashboardPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top,_rgba(186,230,253,0.12),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(125,211,252,0.12),_transparent_60%)]" />
      <div className="pointer-events-none absolute -top-56 left-1/2 -z-10 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-sky-400/25 blur-[180px]" />
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-16 md:px-10">
        <SupabaseAuthProvider>
          <StaffDashboard />
        </SupabaseAuthProvider>
      </main>
    </div>
  );
}
