"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ProfileRecord,
  useSupabaseAuth,
} from "@/components/customer/SupabaseAuthProvider";
import { StaffAuthForm } from "./StaffAuthForm";

type DatabaseRow = Record<string, unknown>;

type QuoteSummary = {
  id: string;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  contact_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  user_id: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  customer_notes?: string | null;
  internal_notes?: string | null;
};

type QuoteFileRecord = {
  linkId: string;
  fileId: string;
  path: string;
  originalName: string | null;
  mime: string | null;
  sizeBytes: number | null;
  createdAt: string | null;
  signedUrl: string | null;
  userId: string | null;
};

type InvoiceRecord = {
  id: string;
  quote_id?: string | null;
  status?: string | null;
  amount_cents?: number | null;
  total_cents?: number | null;
  total?: number | null;
  created_at?: string | null;
  due_date?: string | null;
  paid_at?: string | null;
  invoice_url?: string | null;
  public_url?: string | null;
  external_url?: string | null;
  stripe_invoice_url?: string | null;
  square_invoice_url?: string | null;
};

type QuoteDetails = {
  profile: ProfileRecord | null;
  files: QuoteFileRecord[];
  invoices: InvoiceRecord[];
};

type UploadRecord = {
  id: string;
  user_id: string | null;
  path: string;
  original_name?: string | null;
  mime?: string | null;
  size_bytes?: number | null;
  created_at?: string | null;
};

const QUOTES_TABLE =
  process.env.NEXT_PUBLIC_SUPABASE_QUOTES_TABLE?.trim() ||
  process.env.SUPABASE_QUOTES_TABLE?.trim() ||
  "quotes";
const QUOTE_FILES_TABLE =
  process.env.NEXT_PUBLIC_SUPABASE_QUOTE_FILES_TABLE?.trim() ||
  process.env.SUPABASE_QUOTE_FILES_TABLE?.trim() ||
  "quote_files";
const USER_FILES_TABLE =
  process.env.NEXT_PUBLIC_SUPABASE_USER_FILES_TABLE?.trim() ||
  process.env.SUPABASE_USER_FILES_TABLE?.trim() ||
  "user_files";
const INVOICES_TABLE =
  process.env.NEXT_PUBLIC_SUPABASE_INVOICES_TABLE?.trim() ||
  process.env.SUPABASE_INVOICES_TABLE?.trim() ||
  "invoices";
const PROFILES_TABLE =
  process.env.NEXT_PUBLIC_SUPABASE_PROFILES_TABLE?.trim() ||
  process.env.SUPABASE_PROFILES_TABLE?.trim() ||
  "profiles";
const UPLOADS_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_UPLOADS_BUCKET?.trim() ||
  process.env.SUPABASE_UPLOADS_BUCKET?.trim() ||
  "client_uploads";

const QUOTE_STATUSES = [
  "submitted",
  "new",
  "review",
  "approved",
  "invoiced",
  "completed",
  "archived",
  "cancelled",
];

const INVOICE_STATUSES = [
  "draft",
  "sent",
  "open",
  "paid",
  "void",
  "uncollectible",
];

function toRowId(value: unknown): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (
    typeof globalThis !== "undefined" &&
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `tmp-${Math.random().toString(36).slice(2, 10)}`;
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || Number.isNaN(bytes)) {
    return "—";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function resolveAmount(
  cents?: number | null,
  fallback?: number | null,
): number | null {
  if (typeof cents === "number" && Number.isFinite(cents)) {
    return cents / 100;
  }
  if (typeof fallback === "number" && Number.isFinite(fallback)) {
    return fallback;
  }
  return null;
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function resolveInvoiceUrl(invoice: InvoiceRecord): string | null {
  const candidates = [
    invoice.public_url,
    invoice.invoice_url,
    invoice.external_url,
    invoice.stripe_invoice_url,
    invoice.square_invoice_url,
  ];
  const resolved = candidates.find(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
  return resolved ? String(resolved).trim() : null;
}

export function StaffDashboard() {
  const {
    supabase,
    user,
    profile,
    profileLoading,
    profileError,
    signOut,
  } = useSupabaseAuth();

  const isStaff = Boolean(profile?.is_staff);

  const [activeView, setActiveView] = useState<"quotes" | "uploads">("quotes");
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  const [quoteDetails, setQuoteDetails] = useState<QuoteDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailMessage, setDetailMessage] = useState<string | null>(null);

  const [statusDraft, setStatusDraft] = useState<string>("");
  const [teamNotesDraft, setTeamNotesDraft] = useState<string>("");
  const [metaSaving, setMetaSaving] = useState(false);

  const [invoiceDraftStatuses, setInvoiceDraftStatuses] = useState<
    Record<string, string>
  >({});
  const [newInvoiceAmount, setNewInvoiceAmount] = useState("");
  const [newInvoiceDueDate, setNewInvoiceDueDate] = useState("");
  const [newInvoiceStatus, setNewInvoiceStatus] = useState("draft");
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [uploadsError, setUploadsError] = useState<string | null>(null);
  const [uploadsLoaded, setUploadsLoaded] = useState(false);
  const [uploadPreviewLoading, setUploadPreviewLoading] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    if (!isStaff) {
      setQuotes([]);
      setSelectedQuoteId(null);
      setQuoteDetails(null);
      return;
    }
    void loadQuotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaff]);

  useEffect(() => {
    if (!isStaff || activeView !== "uploads" || uploadsLoaded) {
      return;
    }
    void loadUploads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaff, activeView, uploadsLoaded]);

  const selectedQuote = useMemo(
    () => quotes.find((quote) => quote.id === selectedQuoteId) ?? null,
    [quotes, selectedQuoteId],
  );

  const filteredQuotes = useMemo(() => {
    if (statusFilter === "all") {
      return quotes;
    }
    if (statusFilter === "awaiting") {
      return quotes.filter((quote) => {
        const status = quote.status?.toLowerCase() ?? "";
        return status === "" || status === "submitted" || status === "new";
      });
    }
    return quotes.filter(
      (quote) =>
        (quote.status ?? "").toLowerCase() === statusFilter.toLowerCase(),
    );
  }, [quotes, statusFilter]);

  useEffect(() => {
    if (!selectedQuote) {
      setStatusDraft("");
      setTeamNotesDraft("");
      setQuoteDetails(null);
      return;
    }

    setStatusDraft(selectedQuote.status ?? "");
    setTeamNotesDraft(selectedQuote.internal_notes ?? "");
    void loadQuoteDetails(selectedQuote);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuote?.id]);

  useEffect(() => {
    if (!quoteDetails) {
      setInvoiceDraftStatuses({});
      return;
    }
    const drafts: Record<string, string> = {};
    quoteDetails.invoices.forEach((invoice) => {
      drafts[invoice.id] = invoice.status?.toString() ?? "draft";
    });
    setInvoiceDraftStatuses(drafts);
  }, [quoteDetails]);

  async function loadQuotes() {
    setQuotesLoading(true);
    setQuotesError(null);
    try {
      const { data, error } = await supabase
        .from(QUOTES_TABLE)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        throw error;
      }

      const rows = Array.isArray(data) ? data : [];
      const mapped = rows.map((row) => {
        const record = row as DatabaseRow;
        return {
          id: toRowId(record.id),
          status:
            record.status !== undefined && record.status !== null
              ? String(record.status)
              : null,
          created_at:
            record.created_at !== undefined && record.created_at !== null
              ? String(record.created_at)
              : null,
          updated_at:
            record.updated_at !== undefined && record.updated_at !== null
              ? String(record.updated_at)
              : null,
          contact_name:
            record.contact_name !== undefined && record.contact_name !== null
              ? String(record.contact_name)
              : null,
          company_name:
            record.company_name !== undefined && record.company_name !== null
              ? String(record.company_name)
              : null,
          email:
            record.email !== undefined && record.email !== null
              ? String(record.email)
              : null,
          phone:
            record.phone !== undefined && record.phone !== null
              ? String(record.phone)
              : null,
          user_id:
            record.user_id !== undefined && record.user_id !== null
              ? String(record.user_id)
              : null,
          address_line1:
            record.address_line1 !== undefined && record.address_line1 !== null
              ? String(record.address_line1)
              : null,
          address_line2:
            record.address_line2 !== undefined && record.address_line2 !== null
              ? String(record.address_line2)
              : null,
          city:
            record.city !== undefined && record.city !== null
              ? String(record.city)
              : null,
          state:
            record.state !== undefined && record.state !== null
              ? String(record.state)
              : null,
          postal_code:
            record.postal_code !== undefined && record.postal_code !== null
              ? String(record.postal_code)
              : null,
          customer_notes:
            record.notes !== undefined && record.notes !== null
              ? String(record.notes)
              : null,
          internal_notes:
            record.internal_notes !== undefined &&
            record.internal_notes !== null
              ? String(record.internal_notes)
              : null,
        } satisfies QuoteSummary;
      });

      setQuotes(mapped);

      setSelectedQuoteId((current) => {
        if (current && mapped.some((quote) => quote.id === current)) {
          return current;
        }
        return mapped[0]?.id ?? null;
      });
    } catch (error) {
      console.error("Failed to load quotes", error);
      setQuotesError(
        error instanceof Error && error.message
          ? error.message
          : "Unable to load quotes right now.",
      );
    } finally {
      setQuotesLoading(false);
    }
  }

  async function loadQuoteDetails(quote: QuoteSummary) {
    setDetailsLoading(true);
    setDetailsError(null);
    setDetailMessage(null);

    try {
      const profilePromise = quote.user_id
        ? supabase
            .from(PROFILES_TABLE)
            .select(
              "user_id, full_name, company_name, phone, email, address_line1, address_line2, city, state, postal_code, notes, is_staff",
            )
            .eq("user_id", quote.user_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const fileLinksPromise = supabase
        .from(QUOTE_FILES_TABLE)
        .select("id, quote_id, file_id")
        .eq("quote_id", quote.id);

      const invoicesPromise = supabase
        .from(INVOICES_TABLE)
        .select(
          "id, quote_id, status, amount_cents, total_cents, total, created_at, due_date, paid_at, invoice_url, public_url, external_url, stripe_invoice_url, square_invoice_url",
        )
        .eq("quote_id", quote.id)
        .order("created_at", { ascending: false });

      const [profileResult, fileLinksResult, invoicesResult] = await Promise.all(
        [profilePromise, fileLinksPromise, invoicesPromise],
      );

      if (
        profileResult.error &&
        profileResult.error.code !== "PGRST116" &&
        profileResult.error.code !== "PGRST103"
      ) {
        throw profileResult.error;
      }

      if (fileLinksResult.error) {
        throw fileLinksResult.error;
      }

      if (invoicesResult.error) {
        throw invoicesResult.error;
      }

      const fileLinks = Array.isArray(fileLinksResult.data)
        ? fileLinksResult.data
        : [];
      const fileIds = fileLinks
        .map((link) => (link && typeof link.file_id !== "undefined" ? link.file_id : null))
        .filter((value): value is string | number => value !== null);

      let filesById: Record<string, DatabaseRow> = {};
      if (fileIds.length > 0) {
        const { data: filesData, error: filesError } = await supabase
          .from(USER_FILES_TABLE)
          .select(
            "id, user_id, path, original_name, mime, size_bytes, created_at",
          )
          .in(
            "id",
            fileIds.map((value) => value),
          );

        if (filesError) {
          throw filesError;
        }

        filesById = Object.fromEntries(
          (filesData ?? []).map((file) => [
            toRowId((file as DatabaseRow).id),
            file as DatabaseRow,
          ]),
        );
      }

      const files = (
        await Promise.all(
          fileLinks.map(async (link) => {
            const record = link as DatabaseRow;
            const fileIdRaw =
              record.file_id !== undefined && record.file_id !== null
                ? record.file_id
                : null;
            const fileId = fileIdRaw ? toRowId(fileIdRaw) : null;
            if (!fileId) {
              return null;
            }
            const fileRecord = filesById[fileId];
            if (!fileRecord) {
              return null;
            }
            const path =
              fileRecord.path !== undefined && fileRecord.path !== null
                ? String(fileRecord.path)
                : "";
            let signedUrl: string | null = null;
            if (path) {
              const { data: signedData, error: signedError } =
                await supabase.storage
                  .from(UPLOADS_BUCKET)
                  .createSignedUrl(path, 600);
              if (signedError) {
                console.warn("Failed to create signed URL for file", signedError);
              } else {
                signedUrl = signedData?.signedUrl ?? null;
              }
            }
            return {
              linkId: toRowId(record.id),
              fileId,
              path,
              originalName:
                fileRecord.original_name !== undefined &&
                fileRecord.original_name !== null
                  ? String(fileRecord.original_name)
                  : null,
              mime:
                fileRecord.mime !== undefined && fileRecord.mime !== null
                  ? String(fileRecord.mime)
                  : null,
              sizeBytes:
                fileRecord.size_bytes !== undefined &&
                fileRecord.size_bytes !== null
                  ? Number(fileRecord.size_bytes)
                  : null,
              createdAt:
                fileRecord.created_at !== undefined &&
                fileRecord.created_at !== null
                  ? String(fileRecord.created_at)
                  : null,
              signedUrl,
              userId:
                fileRecord.user_id !== undefined && fileRecord.user_id !== null
                  ? String(fileRecord.user_id)
                  : null,
            } satisfies QuoteFileRecord;
          }),
        )
      ).filter((item): item is QuoteFileRecord => item !== null);

      const invoices = (Array.isArray(invoicesResult.data)
        ? invoicesResult.data
        : []
      ).map((row) => {
        const record = row as DatabaseRow;
        return {
          id: toRowId(record.id),
          quote_id:
            record.quote_id !== undefined && record.quote_id !== null
              ? String(record.quote_id)
              : null,
          status:
            record.status !== undefined && record.status !== null
              ? String(record.status)
              : null,
          amount_cents:
            record.amount_cents !== undefined && record.amount_cents !== null
              ? Number(record.amount_cents)
              : null,
          total_cents:
            record.total_cents !== undefined && record.total_cents !== null
              ? Number(record.total_cents)
              : null,
          total:
            record.total !== undefined && record.total !== null
              ? Number(record.total)
              : null,
          created_at:
            record.created_at !== undefined && record.created_at !== null
              ? String(record.created_at)
              : null,
          due_date:
            record.due_date !== undefined && record.due_date !== null
              ? String(record.due_date)
              : null,
          paid_at:
            record.paid_at !== undefined && record.paid_at !== null
              ? String(record.paid_at)
              : null,
          invoice_url:
            record.invoice_url !== undefined && record.invoice_url !== null
              ? String(record.invoice_url)
              : null,
          public_url:
            record.public_url !== undefined && record.public_url !== null
              ? String(record.public_url)
              : null,
          external_url:
            record.external_url !== undefined && record.external_url !== null
              ? String(record.external_url)
              : null,
          stripe_invoice_url:
            record.stripe_invoice_url !== undefined &&
            record.stripe_invoice_url !== null
              ? String(record.stripe_invoice_url)
              : null,
          square_invoice_url:
            record.square_invoice_url !== undefined &&
            record.square_invoice_url !== null
              ? String(record.square_invoice_url)
              : null,
        } satisfies InvoiceRecord;
      });

      setQuoteDetails({
        profile: (profileResult.data as ProfileRecord | null) ?? null,
        files,
        invoices,
      });
    } catch (error) {
      console.error("Failed to load quote details", error);
      setDetailsError(
        error instanceof Error && error.message
          ? error.message
          : "Unable to load quote details.",
      );
      setQuoteDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  }

  async function handleSaveQuoteMeta() {
    if (!selectedQuote) {
      return;
    }

    const trimmedNotes = teamNotesDraft.trim();
    const updates: Record<string, unknown> = {};

    const normalizedStatus = statusDraft.trim();
    if (
      normalizedStatus &&
      normalizedStatus !== (selectedQuote.status ?? "").trim()
    ) {
      updates.status = normalizedStatus;
    }

    if (trimmedNotes !== (selectedQuote.internal_notes ?? "").trim()) {
      updates.internal_notes = trimmedNotes || null;
    }

    if (Object.keys(updates).length === 0) {
      setDetailMessage("No changes to save.");
      return;
    }

    setMetaSaving(true);
    setDetailMessage(null);
    setDetailsError(null);

    try {
      const { error } = await supabase
        .from(QUOTES_TABLE)
        .update(updates)
        .eq("id", selectedQuote.id);

      if (error) {
        throw error;
      }

      setQuotes((current) =>
        current.map((quote) =>
          quote.id === selectedQuote.id
            ? {
                ...quote,
                status:
                  updates.status !== undefined
                    ? String(updates.status)
                    : quote.status,
                internal_notes:
                  updates.internal_notes !== undefined
                    ? (updates.internal_notes as string | null)
                    : quote.internal_notes,
              }
            : quote,
        ),
      );

      setDetailMessage("Quote status and notes updated.");
    } catch (error) {
      console.error("Failed to update quote", error);
      setDetailsError(
        error instanceof Error && error.message
          ? error.message
          : "Unable to update quote details.",
      );
    } finally {
      setMetaSaving(false);
    }
  }

  async function handleCreateInvoice() {
    if (!selectedQuote) {
      return;
    }

    const amountValue = Number.parseFloat(newInvoiceAmount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setDetailsError("Enter a positive invoice amount.");
      return;
    }

    const amountCents = Math.round(amountValue * 100);
    const dueDateIso = newInvoiceDueDate
      ? new Date(`${newInvoiceDueDate}T00:00:00Z`).toISOString()
      : null;

    setCreatingInvoice(true);
    setDetailsError(null);
    setDetailMessage(null);

    try {
      const insertPayload: Record<string, unknown> = {
        quote_id: selectedQuote.id,
        amount_cents: amountCents,
        status: newInvoiceStatus,
      };
      if (dueDateIso) {
        insertPayload.due_date = dueDateIso;
      }

      const { error } = await supabase
        .from(INVOICES_TABLE)
        .insert(insertPayload);

      if (error) {
        throw error;
      }

      setNewInvoiceAmount("");
      setNewInvoiceDueDate("");
      setNewInvoiceStatus("draft");
      setDetailMessage("Invoice created. Refresh to pull external payment links.");

      await loadQuoteDetails(selectedQuote);
    } catch (error) {
      console.error("Failed to create invoice", error);
      setDetailsError(
        error instanceof Error && error.message
          ? error.message
          : "Unable to create invoice.",
      );
    } finally {
      setCreatingInvoice(false);
    }
  }

  async function handleUpdateInvoiceStatus(invoiceId: string) {
    const nextStatus = invoiceDraftStatuses[invoiceId]?.trim();
    if (!nextStatus) {
      setDetailsError("Select a status before saving.");
      return;
    }

    setDetailsError(null);
    setDetailMessage(null);

    try {
      const { error } = await supabase
        .from(INVOICES_TABLE)
        .update({ status: nextStatus })
        .eq("id", invoiceId);

      if (error) {
        throw error;
      }

      setQuoteDetails((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          invoices: current.invoices.map((invoice) =>
            invoice.id === invoiceId
              ? {
                  ...invoice,
                  status: nextStatus,
                }
              : invoice,
          ),
        };
      });

      setDetailMessage("Invoice status updated.");
    } catch (error) {
      console.error("Failed to update invoice", error);
      setDetailsError(
        error instanceof Error && error.message
          ? error.message
          : "Unable to update invoice status.",
      );
    }
  }

  async function loadUploads() {
    setUploadsLoading(true);
    setUploadsError(null);
    try {
      const { data, error } = await supabase
        .from(USER_FILES_TABLE)
        .select("id, user_id, path, original_name, mime, size_bytes, created_at")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        throw error;
      }

      const rows = Array.isArray(data) ? data : [];
      const mapped = rows.map((row) => {
        const record = row as DatabaseRow;
        return {
          id: toRowId(record.id),
          user_id:
            record.user_id !== undefined && record.user_id !== null
              ? String(record.user_id)
              : null,
          path:
            record.path !== undefined && record.path !== null
              ? String(record.path)
              : "",
          original_name:
            record.original_name !== undefined &&
            record.original_name !== null
              ? String(record.original_name)
              : null,
          mime:
            record.mime !== undefined && record.mime !== null
              ? String(record.mime)
              : null,
          size_bytes:
            record.size_bytes !== undefined && record.size_bytes !== null
              ? Number(record.size_bytes)
              : null,
          created_at:
            record.created_at !== undefined && record.created_at !== null
              ? String(record.created_at)
              : null,
        } satisfies UploadRecord;
      });

      setUploads(mapped);
      setUploadsLoaded(true);
    } catch (error) {
      console.error("Failed to load uploads", error);
      setUploadsError(
        error instanceof Error && error.message
          ? error.message
          : "Unable to load uploads right now.",
      );
    } finally {
      setUploadsLoading(false);
    }
  }

  async function handlePreviewUpload(upload: UploadRecord) {
    if (!upload.path) {
      setUploadsError("That file does not have a storage path.");
      return;
    }

    setUploadsError(null);
    setUploadPreviewLoading((current) => ({
      ...current,
      [upload.id]: true,
    }));

    try {
      const { data, error } = await supabase.storage
        .from(UPLOADS_BUCKET)
        .createSignedUrl(upload.path, 600);

      if (error || !data?.signedUrl) {
        throw error ?? new Error("Preview link unavailable.");
      }

      if (typeof window !== "undefined") {
        window.open(data.signedUrl, "_blank", "noopener");
      } else {
        setDetailMessage(`Signed URL: ${data.signedUrl}`);
      }
    } catch (error) {
      console.error("Failed to preview upload", error);
      setUploadsError(
        error instanceof Error && error.message
          ? error.message
          : "Unable to generate preview right now.",
      );
    } finally {
      setUploadPreviewLoading((current) => ({
        ...current,
        [upload.id]: false,
      }));
    }
  }

  if (!user) {
    return <StaffAuthForm />;
  }

  if (profileLoading) {
    return (
      <div className="rounded-[2.5rem] border border-white/10 bg-slate-950/80 p-10 text-sm text-slate-300 ring-1 ring-white/10">
        Checking your staff credentials…
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="space-y-4 rounded-[2.5rem] border border-red-500/60 bg-red-500/10 p-10 text-sm text-red-100 ring-1 ring-red-500/60">
        <p>{profileError}</p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-full border border-red-400/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-red-100 transition hover:bg-red-400/20"
        >
          Sign out
        </button>
      </div>
    );
  }

  if (!profile || !isStaff) {
    return (
      <div className="space-y-6 rounded-[2.5rem] border border-red-500/60 bg-red-500/10 p-10 ring-1 ring-red-500/60">
        <div className="space-y-3">
          <p className="w-fit rounded-full border border-red-400/60 bg-red-400/20 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-red-100">
            Access denied
          </p>
          <h1 className="text-2xl font-semibold text-red-100">
            This account is not marked as staff.
          </h1>
          <p className="text-sm text-red-100/80">
            Ask an administrator to toggle `is_staff` on your profile inside Supabase
            before returning to the CRM.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-full border border-red-400/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-red-100 transition hover:bg-red-400/20"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4 rounded-[2.5rem] border border-white/10 bg-slate-950/80 p-8 ring-1 ring-white/10 md:p-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="w-fit rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.4em] text-sky-200">
              deckd crm
            </p>
            <h1 className="text-3xl font-semibold text-slate-50 md:text-[2.2rem]">
              Manage quotes, uploads, and invoices.
            </h1>
            <p className="text-sm text-slate-400 md:text-base">
              Filter new requests, review customer references, and draft invoices that
              sync back to the customer portal.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[0.65rem] uppercase tracking-[0.35em] text-slate-300">
            <span className="text-[0.6rem] font-semibold text-sky-200">
              Signed in as
            </span>
            <span>{user.email ?? profile.full_name ?? profile.user_id}</span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-full border border-white/15 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-200 transition hover:border-red-400/60 hover:bg-red-400/10 hover:text-red-200"
            >
              Sign out
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-slate-300">
          <button
            type="button"
            onClick={() => setActiveView("quotes")}
            className={`rounded-full border px-4 py-2 transition ${
              activeView === "quotes"
                ? "border-sky-300/70 bg-sky-400/15 text-sky-100"
                : "border-white/15 bg-black/10 hover:border-sky-200/40 hover:text-sky-100"
            }`}
          >
            Quotes
          </button>
          <button
            type="button"
            onClick={() => setActiveView("uploads")}
            className={`rounded-full border px-4 py-2 transition ${
              activeView === "uploads"
                ? "border-sky-300/70 bg-sky-400/15 text-sky-100"
                : "border-white/15 bg-black/10 hover:border-sky-200/40 hover:text-sky-100"
            }`}
          >
            Uploads
          </button>
        </div>
      </div>

      {activeView === "quotes" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.7fr)]">
          <section className="space-y-5 rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 ring-1 ring-white/10 md:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">
                  Quotes
                </h2>
                <p className="text-xs text-slate-500">
                  {quotes.length} total · {filteredQuotes.length} shown
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadQuotes()}
                className="rounded-full border border-white/15 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-200 transition hover:border-sky-300/60 hover:bg-sky-300/10 hover:text-sky-100"
              >
                Refresh
              </button>
            </div>

            <div className="flex flex-wrap gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-400">
              {["all", "awaiting", ...QUOTE_STATUSES].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-full border px-3 py-1 transition ${
                    statusFilter === status
                      ? "border-sky-300/70 bg-sky-400/15 text-sky-100"
                      : "border-white/15 bg-black/10 hover:border-sky-200/40 hover:text-sky-100"
                  }`}
                >
                  {status === "awaiting" ? "Needs review" : status}
                </button>
              ))}
            </div>

            {quotesLoading ? (
              <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-sm text-slate-300">
                Loading quotes…
              </p>
            ) : quotesError ? (
              <p className="rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-6 text-sm text-red-100">
                {quotesError}
              </p>
            ) : filteredQuotes.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-sm text-slate-300">
                No quotes match this filter yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {filteredQuotes.map((quote) => {
                  const isSelected = quote.id === selectedQuoteId;
                  return (
                    <li key={quote.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedQuoteId(quote.id)}
                        className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                          isSelected
                            ? "border-sky-300/80 bg-sky-400/15 text-sky-100"
                            : "border-white/10 bg-black/20 text-slate-200 hover:border-sky-300/50 hover:bg-sky-300/10 hover:text-sky-50"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-[0.3em]">
                          <span>{quote.status?.toUpperCase() ?? "SUBMITTED"}</span>
                          <span>{formatTimestamp(quote.created_at)}</span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-50">
                          {quote.contact_name ?? quote.company_name ?? "Unnamed project"}
                        </p>
                        <p className="text-xs text-slate-400">
                          {quote.city || quote.state || quote.postal_code
                            ? [quote.city, quote.state, quote.postal_code]
                                .filter(Boolean)
                                .join(", ")
                            : quote.email ?? quote.phone ?? "No contact info"}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-5 rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 ring-1 ring-white/10 md:p-8">
            {selectedQuote ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-[0.6rem] font-semibold uppercase tracking-[0.4em] text-sky-200">
                      Quote overview
                    </p>
                    <h2 className="text-2xl font-semibold text-slate-50">
                      {selectedQuote.contact_name ?? "Unnamed request"}
                    </h2>
                    <p className="text-xs text-slate-400">
                      Created {formatTimestamp(selectedQuote.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-slate-300">
                    <select
                      value={statusDraft}
                      onChange={(event) => setStatusDraft(event.target.value)}
                      className="rounded-full border border-white/15 bg-black/30 px-3 py-2 text-xs text-slate-100 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40"
                    >
                      <option value="">Select status</option>
                      {QUOTE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void handleSaveQuoteMeta()}
                      className="rounded-full border border-sky-300/60 bg-sky-400/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-sky-100 transition hover:bg-sky-400/30 disabled:cursor-not-allowed disabled:border-slate-500/40 disabled:bg-slate-500/20 disabled:text-slate-400"
                      disabled={metaSaving}
                    >
                      {metaSaving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-xs text-slate-300">
                    <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-500">
                      Contact
                    </p>
                    <p className="text-sm font-semibold text-slate-100">
                      {quoteDetails?.profile?.full_name ??
                        selectedQuote.contact_name ??
                        "Unknown"}
                    </p>
                    <p>{quoteDetails?.profile?.company_name ?? selectedQuote.company_name ?? "—"}</p>
                    <p>{quoteDetails?.profile?.email ?? selectedQuote.email ?? "—"}</p>
                    <p>{quoteDetails?.profile?.phone ?? selectedQuote.phone ?? "—"}</p>
                  </div>
                  <div className="space-y-2 rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-xs text-slate-300">
                    <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-500">
                      Address
                    </p>
                    <p>
                      {quoteDetails?.profile?.address_line1 ??
                        selectedQuote.address_line1 ??
                        "—"}
                    </p>
                    <p>
                      {quoteDetails?.profile?.address_line2 ??
                        selectedQuote.address_line2 ??
                        ""}
                    </p>
                    <p>
                      {[quoteDetails?.profile?.city ?? selectedQuote.city, quoteDetails?.profile?.state ?? selectedQuote.state]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </p>
                    <p>
                      {quoteDetails?.profile?.postal_code ??
                        selectedQuote.postal_code ??
                        "—"}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">
                    Customer notes
                  </h3>
                  <p className="mt-2 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-slate-300">
                    {selectedQuote.customer_notes?.trim()
                      ? selectedQuote.customer_notes
                      : "Customer did not leave additional notes."}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">
                    Internal notes
                  </h3>
                  <textarea
                    rows={4}
                    value={teamNotesDraft}
                    onChange={(event) => setTeamNotesDraft(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40"
                    placeholder="Add design direction, approvals, or follow-up steps for the team."
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">
                      Attached files
                    </h3>
                    <button
                      type="button"
                      onClick={() => selectedQuote && void loadQuoteDetails(selectedQuote)}
                      className="rounded-full border border-white/15 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-200 transition hover:border-sky-300/60 hover:bg-sky-300/10 hover:text-sky-100"
                    >
                      Refresh
                    </button>
                  </div>
                  {detailsLoading ? (
                    <p className="mt-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-slate-300">
                      Loading files…
                    </p>
                  ) : quoteDetails?.files?.length ? (
                    <div className="mt-3 grid gap-4 md:grid-cols-2">
                      {quoteDetails.files.map((file) => (
                        <div
                          key={file.linkId}
                          className="group overflow-hidden rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:border-sky-300/50 hover:bg-sky-300/10"
                        >
                          <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-black/40">
                            {file.signedUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={file.signedUrl}
                                alt={file.originalName ?? "Quote reference"}
                                className="absolute inset-0 h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-slate-500">
                                Preview unavailable
                              </div>
                            )}
                          </div>
                          <div className="mt-3 space-y-1 text-xs text-slate-300">
                            <p className="font-semibold text-slate-100">
                              {file.originalName ?? file.path}
                            </p>
                            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-500">
                              {formatFileSize(file.sizeBytes)}
                            </p>
                            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-500">
                              {formatTimestamp(file.createdAt)}
                            </p>
                            <Link
                              href={file.signedUrl ?? "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-slate-200 transition hover:border-sky-300/60 hover:bg-sky-300/10 hover:text-sky-100 disabled:pointer-events-none disabled:opacity-50"
                            >
                              Open file →
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-slate-300">
                      No files attached yet.
                    </p>
                  )}
                </div>

                <div className="space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">
                    Create invoice
                  </h3>
                  <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
                    <label className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-400">
                      Amount (USD)
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newInvoiceAmount}
                        onChange={(event) => setNewInvoiceAmount(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40"
                        placeholder="2500"
                      />
                    </label>
                    <label className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-400">
                      Due date
                      <input
                        type="date"
                        value={newInvoiceDueDate}
                        onChange={(event) => setNewInvoiceDueDate(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40"
                      />
                    </label>
                    <label className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-400">
                      Status
                      <select
                        value={newInvoiceStatus}
                        onChange={(event) => setNewInvoiceStatus(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40"
                      >
                        {INVOICE_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleCreateInvoice()}
                      className="rounded-full border border-emerald-300/60 bg-emerald-400/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-100 transition hover:bg-emerald-400/30 disabled:cursor-not-allowed disabled:border-slate-500/40 disabled:bg-slate-500/20 disabled:text-slate-400"
                      disabled={creatingInvoice}
                    >
                      {creatingInvoice ? "Creating…" : "Create"}
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">
                    Invoices
                  </h3>
                  {quoteDetails?.invoices?.length ? (
                    <ul className="mt-3 space-y-3">
                      {quoteDetails.invoices.map((invoice) => {
                        const amount = resolveAmount(
                          invoice.amount_cents ?? invoice.total_cents,
                          invoice.total,
                        );
                        const invoiceUrl = resolveInvoiceUrl(invoice);
                        return (
                          <li
                            key={invoice.id}
                            className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-sm text-slate-300"
                          >
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div className="space-y-1">
                                <p className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-500">
                                  Invoice {invoice.id.slice(0, 8)}
                                </p>
                                <p className="text-slate-100">
                                  {formatCurrency(amount)}
                                </p>
                                <p className="text-[0.7rem] text-slate-400">
                                  Created {formatTimestamp(invoice.created_at)}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-[0.65rem] uppercase tracking-[0.35em] text-slate-300">
                                <select
                                  value={invoiceDraftStatuses[invoice.id] ?? invoice.status ?? "draft"}
                                  onChange={(event) =>
                                    setInvoiceDraftStatuses((current) => ({
                                      ...current,
                                      [invoice.id]: event.target.value,
                                    }))
                                  }
                                  className="rounded-full border border-white/15 bg-black/30 px-3 py-2 text-xs text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/40"
                                >
                                  {INVOICE_STATUSES.map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => void handleUpdateInvoiceStatus(invoice.id)}
                                  className="rounded-full border border-emerald-300/60 bg-emerald-400/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-100 transition hover:bg-emerald-400/30"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-[0.65rem] uppercase tracking-[0.35em] text-slate-400">
                              {invoice.due_date && (
                                <span className="rounded-full border border-white/10 px-3 py-1">
                                  Due {formatTimestamp(invoice.due_date)}
                                </span>
                              )}
                              {invoice.paid_at && (
                                <span className="rounded-full border border-emerald-400/40 px-3 py-1 text-emerald-100">
                                  Paid {formatTimestamp(invoice.paid_at)}
                                </span>
                              )}
                              {invoiceUrl && (
                                <Link
                                  href={invoiceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-full border border-white/15 px-3 py-1 text-slate-200 transition hover:border-emerald-300/60 hover:bg-emerald-300/10 hover:text-emerald-100"
                                >
                                  Open invoice →
                                </Link>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-slate-300">
                      No invoices created yet.
                    </p>
                  )}
                </div>

                {(detailMessage || detailsError) && (
                  <p
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      detailsError
                        ? "border-red-500/60 bg-red-500/10 text-red-100"
                        : "border-emerald-500/60 bg-emerald-500/10 text-emerald-100"
                    }`}
                  >
                    {detailsError ?? detailMessage}
                  </p>
                )}
              </>
            ) : (
              <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-sm text-slate-300">
                Select a quote to review its details.
              </p>
            )}
          </section>
        </div>
      ) : (
        <section className="space-y-5 rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 ring-1 ring-white/10 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">
                Customer uploads
              </h2>
              <p className="text-xs text-slate-500">
                {uploads.length} files · newest first
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setUploadsLoaded(false);
                void loadUploads();
              }}
              className="rounded-full border border-white/15 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-200 transition hover:border-sky-300/60 hover:bg-sky-300/10 hover:text-sky-100"
            >
              Refresh
            </button>
          </div>

          {uploadsLoading ? (
            <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-sm text-slate-300">
              Loading uploads…
            </p>
          ) : uploadsError ? (
            <p className="rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-6 text-sm text-red-100">
              {uploadsError}
            </p>
          ) : uploads.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-sm text-slate-300">
              No uploads yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-separate border-spacing-y-2 text-left text-xs text-slate-300">
                <thead className="text-[0.6rem] uppercase tracking-[0.35em] text-slate-500">
                  <tr>
                    <th className="rounded-l-xl bg-black/30 px-3 py-2">File</th>
                    <th className="bg-black/30 px-3 py-2">User</th>
                    <th className="bg-black/30 px-3 py-2">Size</th>
                    <th className="bg-black/30 px-3 py-2">Uploaded</th>
                    <th className="rounded-r-xl bg-black/30 px-3 py-2 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((upload) => (
                    <tr key={upload.id}>
                      <td className="rounded-l-xl bg-black/20 px-3 py-3 text-sm text-slate-100">
                        {upload.original_name ?? upload.path}
                      </td>
                      <td className="bg-black/20 px-3 py-3 text-[0.7rem] uppercase tracking-[0.3em] text-slate-400">
                        {upload.user_id ?? "—"}
                      </td>
                      <td className="bg-black/20 px-3 py-3 text-[0.7rem] uppercase tracking-[0.3em] text-slate-400">
                        {formatFileSize(upload.size_bytes ?? null)}
                      </td>
                      <td className="bg-black/20 px-3 py-3 text-[0.7rem] uppercase tracking-[0.3em] text-slate-400">
                        {formatTimestamp(upload.created_at ?? null)}
                      </td>
                      <td className="rounded-r-xl bg-black/20 px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void handlePreviewUpload(upload)}
                          className="rounded-full border border-white/15 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-slate-200 transition hover:border-sky-300/60 hover:bg-sky-300/10 hover:text-sky-100 disabled:cursor-not-allowed disabled:border-slate-500/40 disabled:bg-slate-500/20 disabled:text-slate-400"
                          disabled={uploadPreviewLoading[upload.id]}
                        >
                          {uploadPreviewLoading[upload.id] ? "Opening…" : "Preview"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
