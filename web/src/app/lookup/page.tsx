"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useGeneratedImages } from "@/components/providers/GeneratedImagesProvider";
import { RecentMakeoversStrip } from "@/components/workspace/RecentMakeoversStrip";
import { ProjectCodePanel } from "@/components/project/ProjectCodePanel";

type LookupResult =
  | {
      data: unknown;
    }
  | {
      error: string;
    };

type ActionInfo = {
  statusName: string | null;
  invoiceId: string | null;
  invoiceUrl: string | null;
  canBook: boolean;
  squareUrl: string | null;
  stripeCustomerId: string | null;
  stripePortalUrl: string | null;
  schedulerUrl: string | null;
  projectCode: string | null;
};

type ProjectDetails = {
  title: string | null;
  customerName: string | null;
  email: string | null;
  phone: string | null;
  description: string | null;
  statusName: string | null;
  invoiceId: string | null;
  invoiceUrl: string | null;
  totalCostCents: number | null;
  paid: boolean | null;
  workspaceUrl: string | null;
  publicUrl: string | null;
  publicCode: string | null;
  stripeCustomerId: string | null;
  stripePortalUrl: string | null;
  schedulerUrl: string | null;
};

export default function LookupPage() {
  const { projectCode } = useGeneratedImages();
  const [codeInput, setCodeInput] = useState(projectCode);
  const normalizedCode = useMemo(() => codeInput.trim(), [codeInput]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [rawResponse, setRawResponse] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<ActionInfo | null>(null);
  const [projectDetails, setProjectDetails] = useState<ProjectDetails | null>(
    null,
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const lookupCode = normalizedCode;

    if (!lookupCode) {
      setResult({ error: "Enter a project code before looking it up." });
      setRawResponse(null);
      return;
    }

    setIsLoading(true);
    setResult(null);
    setRawResponse(null);
    setActionInfo(null);
    setProjectDetails(null);

    try {
      const response = await fetch(
        `/api/project/${encodeURIComponent(lookupCode)}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        setResult({
          error:
            typeof payload?.error === "string" && payload.error.trim()
              ? payload.error.trim()
              : `Lookup failed with status ${response.status}`,
        });
        setRawResponse(
          typeof payload === "object" ? JSON.stringify(payload, null, 2) : null,
        );
        setActionInfo(null);
        return;
      }

      if (payload && typeof payload === "object" && "data" in payload) {
        setResult({ data: payload.data });
        setRawResponse(JSON.stringify(payload, null, 2));
        const details = parseProjectDetails(payload.data);
        setProjectDetails(details);
        setActionInfo(details ? buildActionInfo(details) : null);
      } else {
        setResult({
          data: payload,
        });
        setRawResponse(JSON.stringify(payload, null, 2));
        const details = parseProjectDetails(payload);
        setProjectDetails(details);
        setActionInfo(details ? buildActionInfo(details) : null);
      }
    } catch (error) {
      console.error("Failed to lookup project data", error);
      setResult({
        error:
          error instanceof Error && error.message
            ? error.message
            : "Something went wrong while contacting the lookup service.",
      });
      setActionInfo(null);
      setProjectDetails(null);
    } finally {
      setIsLoading(false);
    }
  };

  const renderResult = () => {
    if (!result) return null;

    if ("error" in result) {
      return (
        <div className="rounded-2xl border border-red-500/60 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          {result.error}
        </div>
      );
    }

    const data = result.data ?? null;
    if (data === null) {
      return (
        <div className="rounded-2xl border border-amber-400/60 bg-amber-400/10 px-5 py-4 text-sm text-amber-100">
          No data returned for this code. Double-check the identifier and try again.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {projectDetails && <ProjectSummary details={projectDetails} />}
        {actionInfo && <BookingAction info={actionInfo} />}
        <div className="space-y-3 rounded-2xl border border-white/10 bg-black/25 p-5 text-sm text-slate-200">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-200">
            Lookup result (JSON)
          </p>
          <pre className="max-h-[28rem] overflow-auto rounded-xl border border-white/10 bg-black/40 p-4 text-xs text-slate-200">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(56,189,248,0.1),_transparent_60%)]" />
      <main className="mx-auto flex max-w-5xl flex-col gap-14 px-6 pb-24 pt-24 md:px-10">
        <section className="space-y-10 rounded-[2.5rem] border border-white/10 bg-slate-950/70 p-10 shadow-[0_42px_160px_-90px_rgba(15,23,42,1)] ring-1 ring-white/10 md:p-14">
          <div className="space-y-6">
            <p className="w-fit rounded-full border border-white/15 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.5em] text-amber-200">
              Client portal
            </p>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold leading-tight text-slate-50 md:text-5xl">
                Retrieve project details by public code.
              </h1>
              <p className="max-w-3xl text-base text-slate-300 md:text-lg">
                Enter the workspace or public code shared on the request form. We’ll ask the n8n workflow
                for consolidated notes, files, and metadata tied to that code.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-slate-200">
              <span className="rounded-full border border-white/20 px-3 py-1 uppercase tracking-[0.35em]">
                Unified lookup
              </span>
              <span className="rounded-full border border-white/20 px-3 py-1 uppercase tracking-[0.35em]">
                Paired with requests
              </span>
              <span className="rounded-full border border-white/20 px-3 py-1 uppercase tracking-[0.35em]">
                Powered by n8n
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 rounded-[2rem] border border-white/10 bg-black/25 p-6 md:p-8">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                Project code
              </label>
              <input
                value={codeInput}
                onChange={(event) => setCodeInput(event.target.value)}
                placeholder="HS-0516-ABCD"
                className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-slate-100 outline-none ring-amber-500 transition focus:ring-2"
              />
              <p className="text-xs text-slate-400">
                This matches the code shown in the workspace and sent with the project brief. Case insensitive.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold uppercase tracking-[0.35em] text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-amber-500/70"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                    Looking up…
                  </span>
                ) : (
                  "Lookup project"
                )}
              </button>
              <Link
                href="/workspace"
                className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-100 transition hover:bg-white/10"
              >
                Back to workspace
              </Link>
            </div>
          </form>

          {renderResult()}

          {rawResponse && (
            <details className="rounded-2xl border border-white/10 bg-black/25 p-4 text-xs text-slate-300">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.35em] text-amber-200">
                Raw response
              </summary>
              <pre className="mt-3 max-h-[20rem] overflow-auto rounded-xl border border-white/10 bg-black/40 p-3">
                {rawResponse}
              </pre>
            </details>
          )}
        </section>

        <ProjectCodePanel />
        <RecentMakeoversStrip className="mt-4" />
      </main>
    </div>
  );
}

function ProjectSummary({ details }: { details: ProjectDetails }) {
  const costLabel =
    typeof details.totalCostCents === "number"
      ? `$${(details.totalCostCents / 100).toFixed(2)}`
      : null;

  const contactLines = [details.email, details.phone].filter(Boolean).join(" · ");

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/70 p-5 text-sm text-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-200">
            Project overview
          </p>
          <h2 className="text-lg font-semibold text-slate-50">
            {details.title ?? details.publicCode ?? "Untitled project"}
          </h2>
          {details.statusName && (
            <p className="text-xs text-slate-400">
              Status: <span className="font-medium">{details.statusName}</span>
            </p>
          )}
          {contactLines && (
            <p className="text-xs text-slate-400">{contactLines}</p>
          )}
        </div>
        {costLabel && (
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs text-slate-200">
            Est. total {costLabel}
          </span>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <SummaryCell label="Client" value={details.customerName} />
        <SummaryCell label="Public code" value={details.publicCode} />
        <SummaryCell label="Email" value={details.email} href={details.email ? `mailto:${details.email}` : undefined} />
        <SummaryCell label="Phone" value={details.phone} href={details.phone ? `tel:${details.phone}` : undefined} />
        <SummaryCell label="Invoice ID" value={details.invoiceId} />
        <SummaryCell label="Invoice link" value={details.invoiceUrl} href={details.invoiceUrl ?? undefined} />
        <SummaryCell
          label="Payment status"
          value={
            details.paid === null
              ? null
              : details.paid
                ? "Paid in full"
                : "Payment pending"
          }
        />
        <SummaryCell
          label="Workspace record"
          value={details.workspaceUrl}
          href={details.workspaceUrl ?? undefined}
          display="Open record"
          fallback="—"
        />
        <SummaryCell
          label="Public page"
          value={details.publicUrl}
          href={details.publicUrl ?? undefined}
          display="Client view"
          fallback="—"
        />
      </div>
      {details.description && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
            Notes
          </p>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{details.description}</p>
        </div>
      )}
    </section>
  );
}

function SummaryCell({
  label,
  value,
  href,
  fallback = "—",
  display,
}: {
  label: string;
  value: string | null;
  href?: string;
  fallback?: string;
  display?: string;
}) {
  const hasValue = value && value.trim().length > 0;
  const displayText = display ?? (hasValue ? value!.trim() : null);
  return (
    <div className="space-y-1 rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-slate-300">
      <p className="uppercase tracking-[0.3em] text-slate-500">{label}</p>
      {hasValue && displayText ? (
        href ? (
          <a
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
            className="text-sm font-medium text-slate-100 underline decoration-dotted underline-offset-2"
          >
            {displayText}
          </a>
        ) : (
          <p className="text-sm font-medium text-slate-100">{displayText}</p>
        )
      ) : (
        <p className="text-sm text-slate-500">{fallback}</p>
      )}
    </div>
  );
}

function BookingAction({ info }: { info: ActionInfo }) {
  const [isLaunchingPortal, setIsLaunchingPortal] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const stripePortalUrl = info.stripePortalUrl ?? "";
  const squareUrl = info.squareUrl ?? "";
  const schedulerUrl = info.schedulerUrl ?? "";

  const showStripeOptions = Boolean(info.stripeCustomerId || stripePortalUrl);
  const showSquareFallback = Boolean(!showStripeOptions && squareUrl && info.invoiceId);
  const showSchedulerLink = Boolean(schedulerUrl);

  const handlePortalLaunch = async () => {
    if (!info.stripeCustomerId && stripePortalUrl) {
      window.open(stripePortalUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (!info.stripeCustomerId) {
      return;
    }

    const payload: Record<string, string> = {
      customerId: info.stripeCustomerId,
    };

    if (info.projectCode) {
      payload.projectCode = info.projectCode;
    }

    if (typeof window !== "undefined" && window.location?.href) {
      payload.returnUrl = window.location.href;
    }

    setPortalError(null);
    setIsLaunchingPortal(true);

    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMessage =
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof (data as Record<string, unknown>).error === "string"
            ? ((data as Record<string, unknown>).error as string)
            : "Stripe portal is unavailable right now. Try again soon.";
        setPortalError(errorMessage);
        return;
      }

      if (data && typeof data === "object" && typeof (data as Record<string, unknown>).url === "string") {
        const target = (data as Record<string, unknown>).url as string;
        if (target.trim()) {
          window.location.href = target;
          return;
        }
      }

      setPortalError("Stripe portal responded without a URL. Try again shortly.");
    } catch (error) {
      console.error("Failed to open Stripe portal", error);
      setPortalError("Unable to reach the Stripe portal. Give it another shot in a moment.");
    } finally {
      setIsLaunchingPortal(false);
    }
  };

  if (info.canBook && showStripeOptions) {
    return (
      <div className="space-y-4 rounded-2xl border border-emerald-400/60 bg-emerald-400/10 p-4 text-sm text-emerald-100">
        <p className="text-xs font-semibold uppercase tracking-[0.35em]">
          Ready for checkout
        </p>
        <p>
          Your project is marked as{" "}
          <span className="font-semibold">
            {info.statusName ?? "Returned to client"}
          </span>
          . Use the billing portal to review invoices, update payment methods, and reserve your next
          session.
        </p>
        {portalError && (
          <p className="rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {portalError}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          {info.stripeCustomerId && (
            <button
              onClick={handlePortalLaunch}
              disabled={isLaunchingPortal}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLaunchingPortal ? "Opening portal…" : "Open billing portal"}
            </button>
          )}
          {stripePortalUrl && (
            <a
              target="_blank"
              rel="noreferrer"
              href={stripePortalUrl}
              className="inline-flex items-center justify-center rounded-lg border border-emerald-300/60 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/10"
            >
              Use saved portal link
            </a>
          )}
          {showSchedulerLink && (
            <a
              target="_blank"
              rel="noreferrer"
              href={schedulerUrl}
              className="inline-flex items-center justify-center rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Select appointment time
            </a>
          )}
        </div>
      </div>
    );
  }

  if (info.canBook && showSquareFallback) {
    return (
      <div className="space-y-3 rounded-2xl border border-emerald-400/60 bg-emerald-400/10 p-4 text-sm text-emerald-100">
        <p className="text-xs font-semibold uppercase tracking-[0.35em]">
          Ready for checkout
        </p>
        <p>
          Your project is marked as <span className="font-semibold">Returned to client</span>. Finish
          booking with Square using invoice{" "}
          <span className="font-mono">{info.invoiceId}</span>.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            target="_blank"
            rel="noreferrer"
            href={squareUrl}
            style={{
              backgroundColor: "#006aff",
              border: "none",
              color: "white",
              height: "40px",
              textTransform: "uppercase",
              fontFamily: "'Square Market', sans-serif",
              letterSpacing: "1px",
              lineHeight: "38px",
              padding: "0 28px",
              borderRadius: "8px",
              fontWeight: 500,
              fontSize: "14px",
              cursor: "pointer",
              display: "inline-block",
            }}
          >
            Book now
          </a>
          {showSchedulerLink && (
            <a
              target="_blank"
              rel="noreferrer"
              href={schedulerUrl}
              className="inline-flex items-center justify-center rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Select appointment time
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-slate-200">
      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
        We&apos;re still polishing things
      </p>
      <p>
        {info.statusName
          ? `Current status: ${info.statusName}.`
          : "Your makeover isn’t marked as client-ready just yet."} We’ll deliver the next render set soon—scroll
        down to revisit previous makeovers while you wait. The billing portal unlocks automatically once
        we mark your project as returned to client.
      </p>
    </div>
  );
}

function parseProjectDetails(data: unknown): ProjectDetails | null {
  const record = extractRecord(data);
  if (!record) return null;

  const lookup = createLookup(record);

  const title = readString(lookup, [
    "title",
    "project title",
    "project name",
    "name",
  ]);
  const customerName = readString(lookup, [
    "customer name",
    "client name",
    "client",
    "customer",
  ]);
  const email = readString(lookup, [
    "email",
    "client email",
    "customer email",
    "contact email",
  ]);
  const phone = readString(lookup, [
    "phone",
    "phone number",
    "client phone",
    "customer phone",
    "contact phone",
  ]);
  const description = readLongText(lookup, [
    "description",
    "project description",
    "notes",
    "summary",
    "brief",
  ]);
  const statusName = readString(lookup, [
    "status",
    "status name",
    "public status",
    "project status",
    "stage",
  ]);
  const invoiceId = readString(lookup, [
    "invoice id",
    "square invoice id",
    "invoice reference",
    "invoice number",
  ]);
  const invoiceUrl = readUrl(lookup, [
    "invoice url",
    "square invoice url",
    "invoice link",
  ]);
  const totalCostCents = readMoneyCents(lookup, [
    { keys: ["total cost (cents)", "total cost cents", "total_cost_cents", "quote (cents)", "quote cents"], unit: "cents" },
    { keys: ["total cost", "project total", "quoted amount", "estimate"], unit: "dollars" },
  ]);
  const paid = readBoolean(lookup, [
    "paid",
    "payment complete",
    "payment status",
    "is paid",
  ]);
  const publicCode = readString(lookup, [
    "public code",
    "code",
    "project code",
    "client code",
  ]);
  const workspaceUrl = readUrl(lookup, [
    "workspace url",
    "record url",
    "internal url",
    "airtable url",
    "dashboard url",
    "url",
  ]);
  const publicUrl = readUrl(lookup, [
    "public url",
    "client url",
    "share url",
    "client page",
    "public page",
    "portal url",
  ]);
  const stripeCustomerId = readString(lookup, [
    "stripe customer id",
    "stripe_customer_id",
    "customer id",
  ]);
  const stripePortalUrl = readUrl(lookup, [
    "stripe portal url",
    "billing portal url",
    "portal link",
  ]);
  const schedulerUrl = readUrl(lookup, [
    "scheduler url",
    "scheduling url",
    "booking link",
    "appointment url",
    "calendar url",
  ]);

  return {
    title,
    customerName,
    email,
    phone,
    description,
    statusName,
    invoiceId,
    invoiceUrl,
    totalCostCents,
    paid,
    workspaceUrl,
    publicUrl,
    publicCode,
    stripeCustomerId,
    stripePortalUrl,
    schedulerUrl,
  };
}

function buildActionInfo(details: ProjectDetails): ActionInfo {
  const trimmedStatus = details.statusName?.trim() ?? null;
  const trimmedInvoice = details.invoiceId?.trim() ?? null;
  const trimmedInvoiceUrl = details.invoiceUrl?.trim() ?? null;
  const trimmedCustomerId = details.stripeCustomerId?.trim() ?? null;
  const trimmedPortalUrl = details.stripePortalUrl?.trim() ?? null;
  const trimmedSchedulerUrl = details.schedulerUrl?.trim() ?? null;
  const trimmedProjectCode = details.publicCode?.trim() ?? null;
  const statusSlug = trimmedStatus?.toLowerCase();
  const isReturned = statusSlug === "returned to client";

  const hasStripePortal = Boolean(trimmedCustomerId || trimmedPortalUrl);
  const hasInvoiceBooking = Boolean(trimmedInvoiceUrl || trimmedInvoice);
  const canBook = Boolean(isReturned && (hasStripePortal || hasInvoiceBooking));

  let squareUrl: string | null = null;
  if (hasInvoiceBooking) {
    squareUrl =
      trimmedInvoiceUrl ??
      (trimmedInvoice ? buildSquareBookingUrl(trimmedInvoice) : null);
  }

  return {
    statusName: trimmedStatus,
    invoiceId: trimmedInvoice,
    invoiceUrl: trimmedInvoiceUrl,
    canBook,
    squareUrl,
    stripeCustomerId: trimmedCustomerId,
    stripePortalUrl: trimmedPortalUrl,
    schedulerUrl: trimmedSchedulerUrl,
    projectCode: trimmedProjectCode,
  };
}

type FieldLookup = Map<string, unknown>;

function parseCandidateKeys(key: string): string[] {
  const normalized = key.trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  return compact && compact !== normalized ? [normalized, compact] : [normalized];
}

function createLookup(record: Record<string, unknown>): FieldLookup {
  const lookup: FieldLookup = new Map();
  for (const [key, value] of Object.entries(record)) {
    for (const variant of parseCandidateKeys(key)) {
      if (!lookup.has(variant)) {
        lookup.set(variant, value);
      }
    }
  }
  return lookup;
}

function readString(lookup: FieldLookup, keys: string[]): string | null {
  for (const key of keys) {
    for (const variant of parseCandidateKeys(key)) {
      if (!lookup.has(variant)) continue;
      const found = coerceString(lookup.get(variant));
      if (found) return found;
    }
  }
  return null;
}

function readLongText(lookup: FieldLookup, keys: string[]): string | null {
  const value = readString(lookup, keys);
  return value ?? null;
}

function readUrl(lookup: FieldLookup, keys: string[]): string | null {
  const value = readString(lookup, keys);
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

type MoneyKeyDefinition = {
  keys: string[];
  unit: "cents" | "dollars";
};

function readMoneyCents(lookup: FieldLookup, definitions: MoneyKeyDefinition[]): number | null {
  for (const { keys, unit } of definitions) {
    for (const key of keys) {
      for (const variant of parseCandidateKeys(key)) {
        if (!lookup.has(variant)) continue;
        const rawValue = lookup.get(variant);
        const amount = coerceNumber(rawValue);
        if (amount == null) continue;
        return unit === "dollars" ? Math.round(amount * 100) : Math.round(amount);
      }
    }
  }
  return null;
}

function readBoolean(lookup: FieldLookup, keys: string[]): boolean | null {
  for (const key of keys) {
    for (const variant of parseCandidateKeys(key)) {
      if (!lookup.has(variant)) continue;
      const result = coerceBoolean(lookup.get(variant));
      if (result !== null) return result;
    }
  }
  return null;
}

function coerceString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => coerceString(entry))
      .filter((entry): entry is string => Boolean(entry));
    return parts.length ? parts.join(", ") : null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const candidates = ["text", "name", "value", "title", "label", "email", "url"];
    for (const candidate of candidates) {
      const raw = record[candidate];
      if (typeof raw === "string") {
        const trimmed = raw.trim();
        if (trimmed) return trimmed;
      }
    }
  }
  return null;
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const sanitized = value.replace(/[^0-9.-]+/g, "");
    if (!sanitized) return null;
    const parsed = Number(sanitized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function coerceBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (["true", "yes", "paid", "complete", "completed", "done", "1"].includes(normalized)) {
      return true;
    }
    if (["false", "no", "unpaid", "pending", "0"].includes(normalized)) {
      return false;
    }
  }
  return null;
}

function extractRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const record = extractRecord(entry);
      if (record) return record;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  if (record.fields && typeof record.fields === "object") {
    const fields = record.fields as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...fields };
    if (typeof record.url === "string") {
      merged.url ??= record.url;
      merged.workspaceUrl ??= record.url;
    }
    if (typeof record.publicUrl === "string") {
      merged.publicUrl ??= record.publicUrl;
    }
    if (typeof record.public_url === "string") {
      merged.publicUrl ??= record.public_url;
    }
    if (typeof record.recordUrl === "string") {
      merged.recordUrl ??= record.recordUrl;
    }
    return merged;
  }

  if (record.data && typeof record.data === "object") {
    return extractRecord(record.data);
  }

  return record;
}

function buildSquareBookingUrl(invoiceId: string): string {
  const base = "https://app.squareupsandbox.com/appointments/book/5vk7dtcd2vo6mb/LT69MAKTQ9E1Z/start";
  return `${base}?invoiceId=${encodeURIComponent(invoiceId)}`;
}
