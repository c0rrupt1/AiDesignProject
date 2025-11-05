import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CRM Dashboard | deckd studio",
  description:
    "Internal deckd workspace for reviewing customer quotes, managing uploads, and issuing invoices.",
};

// Force dynamic rendering to avoid build-time errors with iframe
export const dynamic = 'force-dynamic';

export default function CrmDashboardPage() {
  // Redirect to the Vite CRM application
  // In development: http://localhost:5174
  // In production: Configure your deployment to serve the built CRM
  const crmUrl = process.env.NEXT_PUBLIC_CRM_APP_URL || 'http://localhost:5174';

  // For now, we'll render an iframe that embeds the CRM
  // You can also use a full redirect: redirect(crmUrl);

  return (
    <div className="fixed inset-0 w-full h-full">
      <iframe
        src={crmUrl}
        className="w-full h-full border-0"
        title="deckd CRM"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
      />
    </div>
  );
}
