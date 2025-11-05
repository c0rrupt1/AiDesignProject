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

function normalizeStatus(status: string | null | undefined): string {
  return (status ?? "").trim().toLowerCase();
}

function getStatusBadgeClass(status: string | null | undefined): string {
  switch (normalizeStatus(status)) {
    case "approved":
      return "border-emerald-400/50 bg-emerald-400/10 text-emerald-200";
    case "invoiced":
      return "border-amber-400/50 bg-amber-400/10 text-amber-200";
    case "completed":
      return "border-sky-400/50 bg-sky-400/10 text-sky-100";
    case "review":
    case "new":
    case "submitted":
      return "border-rose-400/50 bg-rose-400/10 text-rose-200";
    case "archived":
    case "cancelled":
      return "border-slate-500/60 bg-slate-500/15 text-slate-100";
    default:
      return "border-white/20 bg-white/5 text-slate-100";
  }
}

function getStatusLabel(status: string | null | undefined): string {
  const normalized = normalizeStatus(status);
  if (!normalized) {
    return "submitted";
  }
  return normalized;
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
  const [searchTerm, setSearchTerm] = useState("");
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
    let pipeline = quotes;
    if (statusFilter !== "all") {
      if (statusFilter === "awaiting") {
        pipeline = quotes.filter((quote) => {
          const status = normalizeStatus(quote.status);
          return status === "" || status === "submitted" || status === "new";
        });
      } else {
        pipeline = quotes.filter(
          (quote) => normalizeStatus(quote.status) === statusFilter.toLowerCase(),
        );
      }
    }

    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return pipeline;
    }

    return pipeline.filter((quote) => {
      const haystack = [
        quote.contact_name,
        quote.company_name,
        quote.email,
        quote.phone,
        quote.city,
        quote.state,
        quote.postal_code,
        quote.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [quotes, statusFilter, searchTerm]);

  useEffect(() => {
    if (filteredQuotes.length === 0) {
      return;
    }
    setSelectedQuoteId((current) => {
      if (!current) {
        return filteredQuotes[0]?.id ?? null;
      }
      return filteredQuotes.some((quote) => quote.id === current)
        ? current
        : filteredQuotes[0]?.id ?? current;
    });
  }, [filteredQuotes]);

  const quickStats = useMemo(() => {
    const awaiting = quotes.filter((quote) => {
      const status = normalizeStatus(quote.status);
      return status === "" || status === "submitted" || status === "new";
    }).length;
    const reviewing = quotes.filter(
      (quote) => normalizeStatus(quote.status) === "review",
    ).length;
    const approved = quotes.filter(
      (quote) => normalizeStatus(quote.status) === "approved",
    ).length;
    const invoiced = quotes.filter(
      (quote) => normalizeStatus(quote.status) === "invoiced",
    ).length;
    const completed = quotes.filter(
      (quote) => normalizeStatus(quote.status) === "completed",
    ).length;

    return [
      { label: "Needs action", value: awaiting },
      { label: "Reviewing", value: reviewing },
      { label: "Approved", value: approved },
      { label: "Invoiced", value: invoiced },
      { label: "Completed", value: completed },
      { label: "Total", value: quotes.length },
    ];
  }, [quotes]);

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
      <div className="flex min-h-[50vh] items-center justify-center rounded-3xl border border-white/10 bg-slate-950/80 p-12 text-sm text-slate-400">
        Checking your staff credentials…
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="max-w-md space-y-5 rounded-3xl border border-rose-500/60 bg-rose-500/10 p-10 text-sm text-rose-100">
        <p>{profileError}</p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-full border border-rose-400/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-rose-100 transition hover:bg-rose-400/15"
        >
          Sign out
        </button>
      </div>
    );
  }

  if (!profile || !isStaff) {
    return (
      <div className="max-w-lg space-y-6 rounded-3xl border border-rose-500/60 bg-rose-500/10 p-10 text-sm text-rose-100">
        <div className="space-y-3">
          <p className="w-fit rounded-full border border-rose-400/60 bg-rose-400/20 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.4em]">
            Access denied
          </p>
          <h1 className="text-2xl font-semibold">
            This account is not marked as staff.
          </h1>
          <p>
            Ask an administrator to toggle `is_staff` on your profile inside Supabase
            before returning to the CRM.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-full border border-rose-400/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-rose-100 transition hover:bg-rose-400/15"
        >
          Sign out
        </button>
      </div>
    );
  }

  const primaryIdentifier =
    profile.full_name ?? profile.company_name ?? user.email ?? "Staff member";

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.4em] text-sky-300">
              deckd atomic workspace
            </p>
            <h1 className="mt-2 text-xl font-semibold text-slate-100 sm:text-2xl">
              CRM operations cockpit
            </h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-4">
            <div className="text-right text-xs text-slate-400">
              <p className="font-semibold text-slate-100">{primaryIdentifier}</p>
              <p className="uppercase tracking-[0.35em] text-slate-500">Staff</p>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-full border border-white/15 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-slate-200 transition hover:border-rose-400/60 hover:bg-rose-400/10 hover:text-rose-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-white/10 bg-slate-900/60 p-1">
            <button
              type="button"
              onClick={() => setActiveView("quotes")}
              className={`rounded-full px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] transition ${
                activeView === "quotes"
                  ? "bg-sky-500 text-slate-950"
                  : "text-slate-300 hover:text-slate-100"
              }`}
            >
              Pipeline
            </button>
            <button
              type="button"
              onClick={() => setActiveView("uploads")}
              className={`rounded-full px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] transition ${
                activeView === "uploads"
                  ? "bg-sky-500 text-slate-950"
                  : "text-slate-300 hover:text-slate-100"
              }`}
            >
              Uploads
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="hidden sm:inline">{quotes.length} quotes synced</span>
            <span className="hidden sm:inline">·</span>
            <span>{`${uploadsLoaded ? uploads.length : "—"} latest uploads`}</span>
          </div>
        </div>

        {activeView === "quotes" ? (
          <div className="grid flex-1 gap-6 lg:grid-cols-[260px_minmax(0,340px)_minmax(0,1fr)]">
            <aside className="hidden flex-col gap-6 rounded-3xl border border-white/10 bg-slate-900/70 p-5 lg:flex">
              <div>
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-400">
                  Pipeline snapshot
                </p>
                <div className="mt-4 grid gap-3">
                  {quickStats.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3"
                    >
                      <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                        {stat.label}
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-100">
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-400">
                  Status filter
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-300">
                  {["all", "awaiting", ...QUOTE_STATUSES].map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setStatusFilter(status)}
                      className={`rounded-full border px-3 py-1 transition ${
                        statusFilter === status
                          ? "border-sky-400 bg-sky-500 text-slate-950"
                          : "border-white/15 bg-slate-950/60 hover:border-sky-300/50 hover:text-sky-100"
                      }`}
                    >
                      {status === "awaiting" ? "Needs review" : status}
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            <section className="flex min-h-[28rem] flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60">
              <div className="border-b border-white/5 px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-300">
                      Pipeline
                    </h2>
                    <p className="text-xs text-slate-500">
                      Showing {filteredQuotes.length} of {quotes.length}
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
                <div className="mt-4">
                  <label
                    htmlFor="quote-search"
                    className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-400"
                  >
                    Search
                  </label>
                  <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2">
                    <input
                      id="quote-search"
                      type="search"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search by name, company, email, or ID"
                      className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                    />
                    {searchTerm ? (
                      <button
                        type="button"
                        onClick={() => setSearchTerm("")}
                        className="text-[0.6rem] uppercase tracking-[0.35em] text-slate-400 transition hover:text-slate-200"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5">
                {quotesLoading ? (
                  <p className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-6 text-sm text-slate-300">
                    Loading pipeline…
                  </p>
                ) : quotesError ? (
                  <p className="rounded-2xl border border-rose-500/60 bg-rose-500/10 px-4 py-6 text-sm text-rose-100">
                    {quotesError}
                  </p>
                ) : filteredQuotes.length === 0 ? (
                  <p className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-6 text-sm text-slate-300">
                    No quotes match your filter yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {filteredQuotes.map((quote) => {
                      const isSelected = quote.id === selectedQuoteId;
                      const statusLabel = getStatusLabel(quote.status);
                      return (
                        <li key={quote.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedQuoteId(quote.id)}
                            className={`group w-full rounded-2xl border px-4 py-4 text-left transition ${
                              isSelected
                                ? "border-sky-400/70 bg-sky-500/10"
                                : "border-white/10 bg-slate-950/40 hover:border-sky-300/50 hover:bg-sky-500/5"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span
                                className={`inline-flex items-center rounded-full border px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.35em] ${getStatusBadgeClass(quote.status)}`}
                              >
                                {statusLabel}
                              </span>
                              <span className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-500">
                                {formatTimestamp(quote.created_at)}
                              </span>
                            </div>
                            <div className="mt-3 flex items-baseline justify-between gap-3">
                              <p className="text-sm font-semibold text-slate-100">
                                {quote.contact_name ??
                                  quote.company_name ??
                                  "Untitled request"}
                              </p>
                              {quote.company_name ? (
                                <span className="text-xs text-slate-400">
                                  {quote.company_name}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {quote.email ??
                                quote.phone ??
                                quote.city ??
                                "No contact details"}
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>

            <section className="flex min-h-[28rem] flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60">
              {selectedQuote ? (
                <>
                  <div className="border-b border-white/5 px-5 py-4 sm:px-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2">
                        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-sky-300">
                          Quote {selectedQuote.id.slice(0, 8)}
                        </p>
                        <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">
                          {selectedQuote.contact_name ?? "Unnamed request"}
                        </h2>
                        <p className="text-xs text-slate-500">
                          Created {formatTimestamp(selectedQuote.created_at)}
                        </p>
                      </div>
                      <div className="space-y-2 text-right text-xs text-slate-400">
                        <p>Last update {formatTimestamp(selectedQuote.updated_at)}</p>
                        <span
                          className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.35em] ${getStatusBadgeClass(selectedQuote.status)}`}
                        >
                          {getStatusLabel(selectedQuote.status)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
                    {detailsError ? (
                      <p className="mb-4 rounded-2xl border border-rose-500/60 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
                        {detailsError}
                      </p>
                    ) : null}
                    {detailMessage ? (
                      <p className="mb-4 rounded-2xl border border-emerald-400/50 bg-emerald-400/10 px-4 py-4 text-sm text-emerald-100">
                        {detailMessage}
                      </p>
                    ) : null}
                    {detailsLoading ? (
                      <p className="mb-4 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 text-sm text-slate-300">
                        Syncing latest details…
                      </p>
                    ) : null}

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-400">
                          Contact
                        </p>
                        <div className="mt-3 space-y-1 text-sm text-slate-200">
                          <p className="font-semibold text-slate-100">
                            {quoteDetails?.profile?.full_name ??
                              selectedQuote.contact_name ??
                              "Unknown contact"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {quoteDetails?.profile?.company_name ??
                              selectedQuote.company_name ??
                              "—"}
                          </p>
                        </div>
                        <dl className="mt-4 space-y-2 text-xs text-slate-400">
                          <div className="flex justify-between gap-4">
                            <dt className="uppercase tracking-[0.3em]">Email</dt>
                            <dd className="text-right text-slate-200">
                              {quoteDetails?.profile?.email ??
                                selectedQuote.email ??
                                "—"}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="uppercase tracking-[0.3em]">Phone</dt>
                            <dd className="text-right text-slate-200">
                              {quoteDetails?.profile?.phone ??
                                selectedQuote.phone ??
                                "—"}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="uppercase tracking-[0.3em]">User</dt>
                            <dd className="text-right text-slate-200">
                              {selectedQuote.user_id ?? "—"}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-400">
                          Address
                        </p>
                        <div className="mt-3 space-y-1 text-sm text-slate-200">
                          <p>
                            {quoteDetails?.profile?.address_line1 ??
                              selectedQuote.address_line1 ??
                              "—"}
                          </p>
                          {(quoteDetails?.profile?.address_line2 ??
                            selectedQuote.address_line2) && (
                            <p>
                              {quoteDetails?.profile?.address_line2 ??
                                selectedQuote.address_line2}
                            </p>
                          )}
                          <p>
                            {[quoteDetails?.profile?.city ?? selectedQuote.city, quoteDetails?.profile?.state ?? selectedQuote.state, quoteDetails?.profile?.postal_code ?? selectedQuote.postal_code]
                              .filter(Boolean)
                              .join(", ") || "—"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,220px)_1fr]">
                        <div className="space-y-2">
                          <label
                            htmlFor="quote-status"
                            className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-400"
                          >
                            Pipeline status
                          </label>
                          <select
                            id="quote-status"
                            value={statusDraft}
                            onChange={(event) => setStatusDraft(event.target.value)}
                            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40"
                          >
                            <option value="">Select status</option>
                            {QUOTE_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label
                            htmlFor="team-notes"
                            className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-400"
                          >
                            Team notes
                          </label>
                          <textarea
                            id="team-notes"
                            value={teamNotesDraft}
                            onChange={(event) => setTeamNotesDraft(event.target.value)}
                            rows={4}
                            placeholder="Internal context, next steps, blockers…"
                            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40"
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                        <span>Changes sync directly to Supabase.</span>
                        <button
                          type="button"
                          onClick={() => void handleSaveQuoteMeta()}
                          className="rounded-full border border-sky-400/70 bg-sky-500/10 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:border-slate-500/40 disabled:bg-slate-500/20 disabled:text-slate-400"
                          disabled={metaSaving}
                        >
                          {metaSaving ? "Saving…" : "Save updates"}
                        </button>
                      </div>
                    </div>

                    {(quoteDetails?.profile?.notes || selectedQuote.customer_notes) && (
                      <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-400">
                          Customer notes
                        </p>
                        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-200">
                          {quoteDetails?.profile?.notes ?? selectedQuote.customer_notes}
                        </p>
                      </div>
                    )}

                    <div className="mt-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">
                          Files
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
                        <p className="mt-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 text-sm text-slate-300">
                          Loading files…
                        </p>
                      ) : quoteDetails?.files?.length ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {quoteDetails.files.map((file) => (
                            <div
                              key={file.linkId}
                              className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                            >
                              <p className="font-semibold text-slate-100">
                                {file.originalName ?? file.path}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {formatFileSize(file.sizeBytes)}
                              </p>
                              <p className="text-xs text-slate-500">
                                {formatTimestamp(file.createdAt)}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {file.signedUrl ? (
                                  <Link
                                    href={file.signedUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-full border border-white/15 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-slate-200 transition hover:border-sky-300/60 hover:bg-sky-300/10 hover:text-sky-100"
                                  >
                                    Open
                                  </Link>
                                ) : (
                                  <span className="rounded-full border border-white/10 px-3 py-1 text-[0.6rem] uppercase tracking-[0.35em] text-slate-500">
                                    No preview
                                  </span>
                                )}
                                {file.userId ? (
                                  <span className="rounded-full border border-white/10 px-3 py-1 text-[0.6rem] uppercase tracking-[0.35em] text-slate-400">
                                    {file.userId}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 text-sm text-slate-300">
                          No files linked yet.
                        </p>
                      )}
                    </div>

                    <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">
                          Create invoice
                        </h3>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
                        <label className="space-y-2 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-400">
                          Amount (USD)
                          <input
                            type="number"
                            value={newInvoiceAmount}
                            onChange={(event) => setNewInvoiceAmount(event.target.value)}
                            min="0"
                            step="0.01"
                            placeholder="1200.00"
                            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/40"
                          />
                        </label>
                        <label className="space-y-2 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-400">
                          Due date
                          <input
                            type="date"
                            value={newInvoiceDueDate}
                            onChange={(event) => setNewInvoiceDueDate(event.target.value)}
                            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/40"
                          />
                        </label>
                        <label className="space-y-2 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-400">
                          Status
                          <select
                            value={newInvoiceStatus}
                            onChange={(event) => setNewInvoiceStatus(event.target.value)}
                            className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/40"
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
                          className="h-fit rounded-full border border-emerald-400/70 bg-emerald-500/10 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:border-slate-500/40 disabled:bg-slate-500/20 disabled:text-slate-400"
                          disabled={creatingInvoice}
                        >
                          {creatingInvoice ? "Creating…" : "Create"}
                        </button>
                      </div>
                      {quoteDetails?.invoices?.length ? (
                        <ul className="space-y-3">
                          {quoteDetails.invoices.map((invoice) => {
                            const amount = resolveAmount(
                              invoice.amount_cents ?? invoice.total_cents,
                              invoice.total,
                            );
                            const invoiceUrl = resolveInvoiceUrl(invoice);
                            return (
                              <li
                                key={invoice.id}
                                className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="space-y-1">
                                    <p className="text-[0.6rem] uppercase tracking-[0.3em] text-slate-500">
                                      Invoice {invoice.id.slice(0, 8)}
                                    </p>
                                    <p className="text-base font-semibold text-slate-100">
                                      {formatCurrency(amount)}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      Created {formatTimestamp(invoice.created_at)}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-[0.6rem] uppercase tracking-[0.35em] text-slate-300">
                                    <select
                                      value={
                                        invoiceDraftStatuses[invoice.id] ??
                                        invoice.status ??
                                        "draft"
                                      }
                                      onChange={(event) =>
                                        setInvoiceDraftStatuses((current) => ({
                                          ...current,
                                          [invoice.id]: event.target.value,
                                        }))
                                      }
                                      className="rounded-full border border-white/15 bg-slate-950/70 px-3 py-2 text-xs text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/40"
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
                                      className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-100 transition hover:bg-emerald-500/20"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.6rem] uppercase tracking-[0.35em] text-slate-400">
                                  {invoice.due_date ? (
                                    <span className="rounded-full border border-white/10 px-3 py-1">
                                      Due {formatTimestamp(invoice.due_date)}
                                    </span>
                                  ) : null}
                                  {invoice.paid_at ? (
                                    <span className="rounded-full border border-emerald-400/40 px-3 py-1 text-emerald-100">
                                      Paid {formatTimestamp(invoice.paid_at)}
                                    </span>
                                  ) : null}
                                  {invoiceUrl ? (
                                    <Link
                                      href={invoiceUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="rounded-full border border-white/15 px-3 py-1 text-slate-200 transition hover:border-emerald-300/60 hover:bg-emerald-500/10 hover:text-emerald-100"
                                    >
                                      Open link
                                    </Link>
                                  ) : null}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 text-sm text-slate-300">
                          No invoices on this quote yet.
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-slate-400">
                  <p>Select a quote from the pipeline to view details.</p>
                  <p className="text-xs text-slate-500">
                    Use the middle column to choose a request.
                  </p>
                </div>
              )}
            </section>
          </div>
        ) : (
          <section className="flex min-h-[28rem] flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60">
            <div className="border-b border-white/5 px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-300">
                    Uploads
                  </h2>
                  <p className="text-xs text-slate-500">
                    Client assets synced from the portal
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-300">
                  <button
                    type="button"
                    onClick={() => setActiveView("quotes")}
                    className="rounded-full border border-white/15 px-3 py-1 transition hover:border-sky-300/60 hover:bg-sky-300/10 hover:text-sky-100"
                  >
                    Pipeline
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadsLoaded(false);
                      void loadUploads();
                    }}
                    className="rounded-full border border-white/15 px-3 py-1 transition hover:border-sky-300/60 hover:bg-sky-300/10 hover:text-sky-100"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-auto px-3 py-4 sm:px-5">
              {uploadsLoading ? (
                <p className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-6 text-sm text-slate-300">
                  Loading uploads…
                </p>
              ) : uploadsError ? (
                <p className="rounded-2xl border border-rose-500/60 bg-rose-500/10 px-4 py-6 text-sm text-rose-100">
                  {uploadsError}
                </p>
              ) : uploads.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-6 text-sm text-slate-300">
                  No uploads yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-separate border-spacing-y-1 text-left text-sm text-slate-200">
                    <thead className="text-xs uppercase tracking-[0.35em] text-slate-500">
                      <tr>
                        <th className="rounded-l-xl bg-slate-950/60 px-3 py-2 font-medium">
                          File
                        </th>
                        <th className="bg-slate-950/60 px-3 py-2 font-medium">
                          User
                        </th>
                        <th className="bg-slate-950/60 px-3 py-2 font-medium">
                          Size
                        </th>
                        <th className="bg-slate-950/60 px-3 py-2 font-medium">
                          Uploaded
                        </th>
                        <th className="rounded-r-xl bg-slate-950/60 px-3 py-2 text-right font-medium">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploads.map((upload) => (
                        <tr key={upload.id}>
                          <td className="rounded-l-xl bg-slate-950/40 px-3 py-3">
                            <p className="font-semibold text-slate-100">
                              {upload.original_name ?? upload.path}
                            </p>
                            <p className="text-xs text-slate-500">{upload.path}</p>
                          </td>
                          <td className="bg-slate-950/40 px-3 py-3 text-xs uppercase tracking-[0.3em] text-slate-400">
                            {upload.user_id ?? "—"}
                          </td>
                          <td className="bg-slate-950/40 px-3 py-3 text-xs uppercase tracking-[0.3em] text-slate-400">
                            {formatFileSize(upload.size_bytes ?? null)}
                          </td>
                          <td className="bg-slate-950/40 px-3 py-3 text-xs uppercase tracking-[0.3em] text-slate-400">
                            {formatTimestamp(upload.created_at ?? null)}
                          </td>
                          <td className="rounded-r-xl bg-slate-950/40 px-3 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => void handlePreviewUpload(upload)}
                              className="rounded-full border border-white/15 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-slate-200 transition hover:border-sky-300/60 hover:bg-sky-300/10 hover:text-sky-100 disabled:cursor-not-allowed disabled:border-slate-500/40 disabled:bg-slate-500/20 disabled:text-slate-400"
                              disabled={Boolean(uploadPreviewLoading[upload.id])}
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
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
