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
  notionUrl: string | null;
  publicUrl: string | null;
  publicCode: string | null;
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
          label="Notion page"
          value={details.notionUrl}
          href={details.notionUrl ?? undefined}
          display="Open in Notion"
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
  if (info.canBook && info.squareUrl && info.invoiceId) {
    return (
      <div className="space-y-3 rounded-2xl border border-emerald-400/60 bg-emerald-400/10 p-4 text-sm text-emerald-100">
        <p className="text-xs font-semibold uppercase tracking-[0.35em]">
          Ready for checkout
        </p>
        <p>
          Your project is marked as <span className="font-semibold">Returned to client</span>. Finish
          booking with Square using invoice <span className="font-mono">{info.invoiceId}</span>.
        </p>
        <a
          target="_blank"
          rel="noreferrer"
          href={info.squareUrl}
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
        down to revisit previous makeovers while you wait.
      </p>
    </div>
  );
}

function extractActionInfo(data: unknown): ActionInfo {
  const details = parseProjectDetails(data);
  if (!details) {
    return {
      statusName: null,
      invoiceId: null,
      invoiceUrl: null,
      canBook: false,
      squareUrl: null,
    };
  }
  return buildActionInfo(details);
}

function parseProjectDetails(data: unknown): ProjectDetails | null {
  let page: Record<string, unknown> | null = null;
  if (Array.isArray(data)) {
    page = data.find(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object" && "properties" in item,
    ) ?? null;
  } else if (data && typeof data === "object" && "properties" in data) {
    page = data as Record<string, unknown>;
  } else if (data && typeof data === "object" && "data" in data) {
    const inner = (data as Record<string, unknown>).data;
    if (inner && typeof inner === "object" && "properties" in inner) {
      page = inner as Record<string, unknown>;
    }
  }

  if (!page) return null;
  const properties = findProperties(page);
  if (!properties) return null;

  const title =
    readTextValue(properties["Name"]) ??
    readTextValue(properties["name"]) ??
    null;
  const customerName =
    readTextValue(properties["Customer Name"]) ??
    readTextValue(properties["customer_name"]) ??
    null;
  const email =
    readEmailValue(properties["Email"]) ??
    readEmailValue(properties["email"]) ??
    null;
  const phone =
    readPhoneValue(properties["Phone"]) ??
    readPhoneValue(properties["phone"]) ??
    null;
  const description =
    readTextValue(properties["Description / Notes"]) ??
    readTextValue(properties["description"]) ??
    null;
  const statusName =
    readSelectName(properties["Public Status"]) ??
    readSelectName(properties["public_status"]) ??
    null;
  const invoiceId =
    readTextValue(properties["Square Invoice ID"]) ??
    readTextValue(properties["square_invoice_id"]) ??
    null;
  const invoiceUrl =
    readUrlValue(properties["Invoice URL"]) ??
    readUrlValue(properties["invoice_url"]) ??
    null;
  const totalCostCents =
    readNumberValue(properties["Total Cost (cents)"]) ??
    readNumberValue(properties["total_cost"]) ??
    null;
  const paid =
    readBooleanValue(properties["Paid?"]) ??
    readBooleanValue(properties["paid"]) ??
    null;
  const publicCode =
    readTextValue(properties["Public Code"]) ??
    readTextValue(properties["public_code"]) ??
    null;

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
    notionUrl: typeof page.url === "string" ? page.url : null,
    publicUrl: typeof page.public_url === "string" ? page.public_url : null,
    publicCode,
  };
}

function buildActionInfo(details: ProjectDetails): ActionInfo {
  const trimmedStatus = details.statusName?.trim() ?? null;
  const trimmedInvoice = details.invoiceId?.trim() ?? null;
  const trimmedInvoiceUrl = details.invoiceUrl?.trim() ?? null;
  const isReturned =
    trimmedStatus &&
    trimmedStatus.toLowerCase() === "returned to client".toLowerCase();
  const canBook = Boolean(isReturned && (trimmedInvoiceUrl || trimmedInvoice));
  let squareUrl: string | null = null;
  if (canBook) {
    squareUrl = trimmedInvoiceUrl ?? (trimmedInvoice ? buildSquareBookingUrl(trimmedInvoice) : null);
  }

  return {
    statusName: trimmedStatus,
    invoiceId: trimmedInvoice,
    invoiceUrl: trimmedInvoiceUrl,
    canBook,
    squareUrl,
  };
}

function findProperties(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.properties && typeof record.properties === "object") {
    return record.properties as Record<string, unknown>;
  }
  if (record.data && typeof record.data === "object") {
    const nested = (record.data as Record<string, unknown>).properties;
    if (nested && typeof nested === "object") {
      return nested as Record<string, unknown>;
    }
  }
  return null;
}

function readSelectName(property: unknown): string | null {
  if (!property || typeof property !== "object") return null;
  const record = property as Record<string, unknown>;
  if (record.select && typeof record.select === "object") {
    const select = record.select as Record<string, unknown>;
    if (typeof select.name === "string") return select.name;
  }
  if (record.type === "select" && typeof record.select === "object") {
    const select = record.select as Record<string, unknown>;
    if (typeof select.name === "string") return select.name;
  }
  return null;
}

function readTextValue(property: unknown): string | null {
  if (property == null) return null;
  if (typeof property === "string") return property.trim() || null;
  if (Array.isArray(property)) {
    for (const item of property) {
      const value = readTextValue(item);
      if (value) return value;
    }
    return null;
  }

  if (typeof property === "object") {
    const record = property as Record<string, unknown>;
    if (record.type === "rich_text" && Array.isArray(record.rich_text)) {
      return readTextValue(record.rich_text);
    }
    if (record.type === "title" && Array.isArray(record.title)) {
      return readTextValue(record.title);
    }
    if (Array.isArray(record.rich_text)) {
      return readTextValue(record.rich_text);
    }
    if (Array.isArray(record.title)) {
      return readTextValue(record.title);
    }
    if (typeof record.plain_text === "string") {
      return record.plain_text.trim() || null;
    }
    if (typeof record.text === "string") {
      return record.text.trim() || null;
    }
  }

  return null;
}

function readEmailValue(property: unknown): string | null {
  if (!property || typeof property !== "object") return null;
  const record = property as Record<string, unknown>;
  if (typeof record.email === "string") {
    return record.email.trim() || null;
  }
  if (record.type === "email" && typeof record.email === "string") {
    return record.email.trim() || null;
  }
  return readTextValue(property);
}

function readPhoneValue(property: unknown): string | null {
  if (!property || typeof property !== "object") return null;
  const record = property as Record<string, unknown>;
  if (typeof record.phone_number === "string") {
    return record.phone_number.trim() || null;
  }
  if (record.type === "phone_number" && typeof record.phone_number === "string") {
    return record.phone_number.trim() || null;
  }
  return readTextValue(property);
}

function readNumberValue(property: unknown): number | null {
  if (!property || typeof property !== "object") return null;
  const record = property as Record<string, unknown>;
  if (typeof record.number === "number") return record.number;
  if (typeof record.value === "number") return record.value;
  return null;
}

function readBooleanValue(property: unknown): boolean | null {
  if (!property || typeof property !== "object") return null;
  const record = property as Record<string, unknown>;
  if (typeof record.checkbox === "boolean") return record.checkbox;
  if (typeof record.bool === "boolean") return record.bool;
  return null;
}

function readUrlValue(property: unknown): string | null {
  if (!property) return null;
  if (typeof property === "string") return property.trim() || null;
  if (typeof property === "object") {
    const record = property as Record<string, unknown>;
    if (typeof record.url === "string") {
      return record.url.trim() || null;
    }
  }
  return null;
}

function buildSquareBookingUrl(invoiceId: string): string {
  const base = "https://app.squareupsandbox.com/appointments/book/5vk7dtcd2vo6mb/LT69MAKTQ9E1Z/start";
  return `${base}?invoiceId=${encodeURIComponent(invoiceId)}`;
}
