"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthForm } from "./AuthForm";
import {
  SupabaseAuthProvider,
  useSupabaseAuth,
} from "./SupabaseAuthProvider";

type DatabaseRow = Record<string, unknown>;

type UserFileRecord = DatabaseRow & {
  id: string;
  path: string;
  original_name?: string | null;
  mime?: string | null;
  size_bytes?: number | null;
  created_at?: string | null;
  signedUrl?: string | null;
};

type QuoteRecord = DatabaseRow & {
  id: string;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  total_cents?: number | null;
  total_estimate_cents?: number | null;
  total?: number | null;
  reference?: string | null;
  title?: string | null;
};

type InvoiceRecord = DatabaseRow & {
  id: string;
  quote_id?: string | null;
  status?: string | null;
  total_cents?: number | null;
  total?: number | null;
  created_at?: string | null;
  due_date?: string | null;
  paid_at?: string | null;
  invoice_url?: string | null;
  public_url?: string | null;
  square_invoice_url?: string | null;
  external_url?: string | null;
  stripe_invoice_url?: string | null;
};

type QuoteFormValues = {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  notes: string;
};

const USER_FILES_TABLE =
  process.env.NEXT_PUBLIC_SUPABASE_USER_FILES_TABLE?.trim() ||
  process.env.SUPABASE_USER_FILES_TABLE?.trim() ||
  "user_files";
const QUOTES_TABLE =
  process.env.NEXT_PUBLIC_SUPABASE_QUOTES_TABLE?.trim() ||
  process.env.SUPABASE_QUOTES_TABLE?.trim() ||
  "quotes";
const QUOTE_FILES_TABLE =
  process.env.NEXT_PUBLIC_SUPABASE_QUOTE_FILES_TABLE?.trim() ||
  process.env.SUPABASE_QUOTE_FILES_TABLE?.trim() ||
  "quote_files";
const INVOICES_TABLE =
  process.env.NEXT_PUBLIC_SUPABASE_INVOICES_TABLE?.trim() ||
  process.env.SUPABASE_INVOICES_TABLE?.trim() ||
  "invoices";
const UPLOADS_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_UPLOADS_BUCKET?.trim() ||
  process.env.SUPABASE_UPLOADS_BUCKET?.trim() ||
  "client_uploads";
const PROFILES_TABLE =
  process.env.NEXT_PUBLIC_SUPABASE_PROFILES_TABLE?.trim() ||
  process.env.SUPABASE_PROFILES_TABLE?.trim() ||
  "profiles";

const tabButtonClass =
  "rounded-full border px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.35em] transition";

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

function resolveAmount(
  cents: number | null | undefined,
  fallback: number | null | undefined,
): number | null {
  if (typeof cents === "number" && Number.isFinite(cents)) {
    return cents / 100;
  }
  if (typeof fallback === "number" && Number.isFinite(fallback)) {
    return fallback;
  }
  return null;
}

function resolveInvoiceUrl(invoice: InvoiceRecord): string | null {
  const candidates = [
    invoice.public_url,
    invoice.invoice_url,
    invoice.square_invoice_url,
    invoice.external_url,
    invoice.stripe_invoice_url,
  ];
  const resolved = candidates.find(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
  return resolved ? String(resolved).trim() : null;
}

function CustomerPortalContent() {
  const {
    supabase,
    session,
    user,
    profile,
    profileLoading,
    profileError,
    refreshProfile,
    signOut,
  } = useSupabaseAuth();

  const [activeTab, setActiveTab] = useState<"uploads" | "quote" | "history">(
    "uploads",
  );

  const [files, setFiles] = useState<UserFileRecord[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const [quoteForm, setQuoteForm] = useState<QuoteFormValues>({
    fullName: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    notes: "",
  });
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteMessage, setQuoteMessage] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      setQuoteForm((current) => ({
        ...current,
        fullName: "",
        phone: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        postalCode: "",
      }));
      return;
    }
    setQuoteForm((current) => ({
      ...current,
      fullName: typeof profile.full_name === "string" ? profile.full_name : "",
      phone: typeof profile.phone === "string" ? profile.phone : "",
      addressLine1:
        typeof profile.address_line1 === "string" ? profile.address_line1 : "",
      addressLine2:
        typeof profile.address_line2 === "string" ? profile.address_line2 : "",
      city: typeof profile.city === "string" ? profile.city : "",
      state: typeof profile.state === "string" ? profile.state : "",
      postalCode:
        typeof profile.postal_code === "string" ? profile.postal_code : "",
    }));
  }, [profile]);

  useEffect(() => {
    if (!user) {
      setFiles([]);
      setQuotes([]);
      setInvoices([]);
      return;
    }

    void loadFiles();
    void loadQuotes();
    void loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    setSelectedFileIds((current) => {
      const next = new Set<string>();
      for (const id of current) {
        if (files.some((file) => file.id === id)) {
          next.add(id);
        }
      }
      return next;
    });
  }, [files]);

  async function loadFiles() {
    if (!user) {
      return;
    }

    setFilesLoading(true);
    setFilesError(null);

    try {
      const { data, error } = await supabase
        .from(USER_FILES_TABLE)
        .select("id,path,original_name,mime,size_bytes,created_at")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const rows = Array.isArray(data) ? data : [];
      const mapped = await Promise.all(
        rows.map(async (row) => {
          const candidateId =
            row && typeof row === "object" && "id" in row
              ? (row as DatabaseRow).id
              : (row as DatabaseRow).path;
          const id = toRowId(candidateId);
          const path =
            row && typeof row === "object" && "path" in row && row.path
              ? String((row as DatabaseRow).path)
              : "";

          let signedUrl: string | null = null;
          if (path) {
            const { data: signed, error: signedError } = await supabase.storage
              .from(UPLOADS_BUCKET)
              .createSignedUrl(path, 120);
            if (signedError) {
              console.warn(
                "Failed to create signed URL for user upload",
                signedError,
              );
            } else {
              signedUrl = signed?.signedUrl ?? null;
            }
          }

          return {
            id,
            path,
            original_name:
              (row as DatabaseRow)?.original_name?.toString() ?? null,
            mime: (row as DatabaseRow)?.mime?.toString() ?? null,
            size_bytes:
              typeof (row as DatabaseRow)?.size_bytes === "number"
                ? ((row as DatabaseRow)?.size_bytes as number)
                : null,
            created_at:
              (row as DatabaseRow)?.created_at?.toString() ?? null,
            signedUrl,
          } satisfies UserFileRecord;
        }),
      );

      setFiles(mapped);
    } catch (error) {
      console.error("Failed to load user files", error);
      setFilesError(
        error instanceof Error && error.message
          ? error.message
          : "We couldn't load your uploads right now.",
      );
    } finally {
      setFilesLoading(false);
    }
  }

  async function loadQuotes() {
    if (!user) {
      return;
    }

    setQuotesLoading(true);
    setQuotesError(null);

    try {
      const { data, error } = await supabase
        .from(QUOTES_TABLE)
        .select("id,status,notes,created_at,updated_at,address_line1,address_line2,city,state,postal_code,total_cents,total_estimate_cents,total,reference,title")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const rows = Array.isArray(data) ? data : [];
      setQuotes(
        rows.map((row) => ({
          ...(row as DatabaseRow),
          id: toRowId(
            row && typeof row === "object" && "id" in row
              ? (row as DatabaseRow).id
              : undefined,
          ),
        })) as QuoteRecord[],
      );
    } catch (error) {
      console.error("Failed to load quotes", error);
      setQuotesError(
        error instanceof Error && error.message
          ? error.message
          : "We couldn't load your quotes right now.",
      );
    } finally {
      setQuotesLoading(false);
    }
  }

  async function loadInvoices() {
    if (!user) {
      return;
    }

    setInvoicesLoading(true);
    setInvoicesError(null);

    try {
      const { data, error } = await supabase
        .from(INVOICES_TABLE)
        .select("id,quote_id,status,total_cents,total,created_at,due_date,paid_at,invoice_url,public_url,square_invoice_url,external_url,stripe_invoice_url")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const rows = Array.isArray(data) ? data : [];
      setInvoices(
        rows.map((row) => ({
          ...(row as DatabaseRow),
          id: toRowId(
            row && typeof row === "object" && "id" in row
              ? (row as DatabaseRow).id
              : undefined,
          ),
        })) as InvoiceRecord[],
      );
    } catch (error) {
      console.error("Failed to load invoices", error);
      setInvoicesError(
        error instanceof Error && error.message
          ? error.message
          : "We couldn't load invoices right now.",
      );
    } finally {
      setInvoicesLoading(false);
    }
  }

  async function handleUpload(filesList: FileList | null) {
    if (!filesList || filesList.length === 0 || !session?.access_token) {
      return;
    }

    setUploadError(null);
    setUploadSuccess(null);
    setUploading(true);

    const items = Array.from(filesList);
    let uploadedCount = 0;

    try {
      for (const file of items) {
        try {
          const uploadPrepared = await fetch("/api/customer/upload-url", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              fileName: file.name,
              contentType: file.type,
              fileSize: file.size,
            }),
          });

          if (!uploadPrepared.ok) {
            const text = await uploadPrepared.text();
            throw new Error(
              text || `Failed to prepare upload (${uploadPrepared.status}).`,
            );
          }

          const preparedPayload = (await uploadPrepared.json()) as {
            uploadUrl: string;
            path: string;
          };

          const uploadResponse = await fetch(preparedPayload.uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Type": file.type || "application/octet-stream",
            },
            body: file,
          });

          if (!uploadResponse.ok) {
            const text = await uploadResponse.text();
            throw new Error(
              text || `Upload failed (${uploadResponse.status}).`,
            );
          }

          const { error: insertError } = await supabase
            .from(USER_FILES_TABLE)
            .insert({
              path: preparedPayload.path,
              original_name: file.name,
              mime: file.type || null,
              size_bytes: file.size,
            });

          if (insertError) {
            throw insertError;
          }

          uploadedCount += 1;
        } catch (error) {
          console.error("Upload failed", error);
          setUploadError(
            error instanceof Error && error.message
              ? error.message
              : "We couldn't upload that file. Please try again.",
          );
          break;
        }
      }

      if (uploadedCount > 0) {
        setUploadSuccess(
          uploadedCount === 1
            ? "File uploaded successfully."
            : `${uploadedCount} files uploaded successfully.`,
        );
        await loadFiles();
      }
    } finally {
      setUploading(false);
    }
  }

  async function submitQuote() {
    if (!user) {
      return;
    }

    setQuoteError(null);
    setQuoteMessage(null);
    setQuoteSubmitting(true);

    const trimmed: QuoteFormValues = {
      fullName: quoteForm.fullName.trim(),
      phone: quoteForm.phone.trim(),
      addressLine1: quoteForm.addressLine1.trim(),
      addressLine2: quoteForm.addressLine2.trim(),
      city: quoteForm.city.trim(),
      state: quoteForm.state.trim(),
      postalCode: quoteForm.postalCode.trim(),
      notes: quoteForm.notes.trim(),
    };

    if (!trimmed.fullName) {
      setQuoteError("Add a contact name so we know who to reach.");
      setQuoteSubmitting(false);
      return;
    }

    try {
      const {
        data: insertedQuote,
        error: quoteInsertError,
      } = await supabase
        .from(QUOTES_TABLE)
        .insert({
          user_id: user.id,
          contact_name: trimmed.fullName || null,
          company_name: null,
          phone: trimmed.phone || null,
          address_line1: trimmed.addressLine1 || null,
          address_line2: trimmed.addressLine2 || null,
          city: trimmed.city || null,
          state: trimmed.state || null,
          postal_code: trimmed.postalCode || null,
          notes: trimmed.notes || null,
          status: "submitted",
        })
        .select("id")
        .maybeSingle();

      if (quoteInsertError) {
        throw quoteInsertError;
      }

      if (!insertedQuote?.id) {
        throw new Error("Quote created but no identifier was returned.");
      }

      const selected = Array.from(selectedFileIds);
      if (selected.length > 0) {
        const linkPayload = selected.map((fileId) => ({
          quote_id: insertedQuote.id,
          file_id: fileId,
        }));
        const { error: quoteFilesError } = await supabase
          .from(QUOTE_FILES_TABLE)
          .insert(linkPayload);
        if (quoteFilesError) {
          throw quoteFilesError;
        }
      }

      setQuoteMessage(
        "Quote requested. We'll review your references and follow up shortly.",
      );
      setQuoteForm((current) => ({
        ...current,
        notes: "",
      }));
      setSelectedFileIds(new Set());
      await refreshProfile();
      await loadQuotes();
    } catch (error) {
      console.error("Failed to submit quote", error);
      setQuoteError(
        error instanceof Error && error.message
          ? error.message
          : "We couldn't submit your quote request right now.",
      );
    } finally {
      setQuoteSubmitting(false);
    }
  }

  const uploadsTab = (
    <section className="space-y-8 rounded-[2.25rem] border border-white/10 bg-slate-950/70 p-8 ring-1 ring-white/10 md:p-10">
      <div className="space-y-3">
        <p className="w-fit rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.4em] text-amber-200">
          Upload references
        </p>
        <h2 className="text-2xl font-semibold text-slate-50 md:text-[2rem]">
          Keep your inspiration shots in one secure place.
        </h2>
        <p className="text-sm text-slate-400 md:text-base">
          Add client photos, mood boards, or sketches. Files stay private to
          your account and are ready to attach to any quote request.
        </p>
      </div>

      <label
        className={`flex cursor-pointer items-center justify-between gap-4 rounded-3xl border border-dashed px-6 py-8 transition ${
          uploading
            ? "border-amber-400/80 bg-amber-400/10"
            : "border-white/20 bg-black/20 hover:border-amber-200/60 hover:bg-amber-200/5"
        }`}
      >
        <div className="flex flex-col gap-1 text-left">
          <span className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-200">
            Click or drag to upload
          </span>
          <span className="text-xs text-slate-400">
            High-resolution JPG, PNG, or PDF. Limit 25MB per file.
          </span>
        </div>
        <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-slate-200">
          {uploading ? "Uploading…" : "Choose files"}
        </span>
        <input
          type="file"
          className="hidden"
          multiple
          onChange={(event) => {
            void handleUpload(event.target.files);
            event.target.value = "";
          }}
          disabled={uploading}
        />
      </label>

      {(uploadError || uploadSuccess) && (
        <p
          className={`rounded-2xl border px-4 py-3 text-sm ${
            uploadError
              ? "border-red-500/60 bg-red-500/10 text-red-100"
              : "border-emerald-500/60 bg-emerald-500/10 text-emerald-100"
          }`}
        >
          {uploadError ?? uploadSuccess}
        </p>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">
            Recent uploads
          </h3>
          <button
            type="button"
            onClick={() => void loadFiles()}
            className="rounded-full border border-white/15 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-300 transition hover:border-amber-300/50 hover:bg-amber-300/10 hover:text-amber-100"
          >
            Refresh
          </button>
        </div>
        {filesLoading ? (
          <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-sm text-slate-300">
            Loading your uploads…
          </p>
        ) : filesError ? (
          <p className="rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-6 text-sm text-red-100">
            {filesError}
          </p>
        ) : files.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-sm text-slate-300">
            No uploads yet. Add your first reference photo above.
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {files.map((file) => (
              <li
                key={file.id}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-amber-300/60 hover:bg-amber-300/10"
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-black/40">
                  {file.signedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={file.signedUrl}
                      alt={file.original_name ?? "Client upload"}
                      className="absolute inset-0 h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-500">
                      Preview unavailable
                    </div>
                  )}
                </div>
                <div className="mt-3 space-y-2 text-xs text-slate-400">
                  <p className="font-medium text-slate-100">
                    {file.original_name ?? file.path}
                  </p>
                  <p className="flex items-center justify-between text-[0.65rem] uppercase tracking-[0.3em] text-slate-500">
                    <span>{formatFileSize(file.size_bytes ?? null)}</span>
                    <span>{formatTimestamp(file.created_at)}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );

  const quoteTab = (
    <section className="space-y-8 rounded-[2.25rem] border border-white/10 bg-slate-950/70 p-8 ring-1 ring-white/10 md:p-10">
      <div className="space-y-3">
        <p className="w-fit rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.4em] text-amber-200">
          Request a quote
        </p>
        <h2 className="text-2xl font-semibold text-slate-50 md:text-[2rem]">
          Attach your favorite uploads and share the project details.
        </h2>
        <p className="text-sm text-slate-400 md:text-base">
          We&apos;ll update your profile with this information and route it
          straight to the deckd team.
        </p>
      </div>

      {profileError && (
        <p className="rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {profileError}
        </p>
      )}

      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">
          Select photos to include
        </h3>
        {files.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-sm text-slate-300">
            Upload reference photos first so you can attach them to your quote.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {files.map((file) => {
              const isSelected = selectedFileIds.has(file.id);
              return (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => {
                    setSelectedFileIds((current) => {
                      const next = new Set(current);
                      if (next.has(file.id)) {
                        next.delete(file.id);
                      } else {
                        next.add(file.id);
                      }
                      return next;
                    });
                  }}
                  className={`relative overflow-hidden rounded-2xl border px-4 pb-4 pt-5 text-left transition ${
                    isSelected
                      ? "border-amber-400/80 bg-amber-400/10 ring-2 ring-amber-400/70"
                      : "border-white/10 bg-black/30 hover:border-amber-300/40 hover:bg-amber-300/5"
                  }`}
                >
                  <span className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-200">
                    {isSelected ? "Selected" : "Select"}
                  </span>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10">
                    {file.signedUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={file.signedUrl}
                        alt={file.original_name ?? "Reference photo"}
                        className="absolute inset-0 h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-500">
                        Preview unavailable
                      </div>
                    )}
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-slate-400">
                    <p className="font-medium text-slate-100">
                      {file.original_name ?? file.path}
                    </p>
                    <p className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-500">
                      {formatTimestamp(file.created_at)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">
          Contact and project details
        </h3>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="quote-full-name"
              className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-slate-400"
            >
              Contact name
            </label>
            <input
              id="quote-full-name"
              value={quoteForm.fullName}
              onChange={(event) =>
                setQuoteForm((current) => ({
                  ...current,
                  fullName: event.target.value,
                }))
              }
              required
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-100 outline-none ring-amber-500 transition focus:ring-2"
              placeholder="Alex Doe"
              disabled={quoteSubmitting || profileLoading}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="quote-phone"
              className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-slate-400"
            >
              Phone
            </label>
            <input
              id="quote-phone"
              value={quoteForm.phone}
              onChange={(event) =>
                setQuoteForm((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-100 outline-none ring-amber-500 transition focus:ring-2"
              placeholder="(555) 123-4567"
              autoComplete="tel"
              disabled={quoteSubmitting || profileLoading}
            />
          </div>
          <div>
            <label
              htmlFor="quote-address-line1"
              className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-slate-400"
            >
              Address line 1
            </label>
            <input
              id="quote-address-line1"
              value={quoteForm.addressLine1}
              onChange={(event) =>
                setQuoteForm((current) => ({
                  ...current,
                  addressLine1: event.target.value,
                }))
              }
              required
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-100 outline-none ring-amber-500 transition focus:ring-2"
              placeholder="123 Main Street"
              autoComplete="address-line1"
              disabled={quoteSubmitting || profileLoading}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="quote-address-line2"
            className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-slate-400"
          >
            Address line 2
          </label>
          <input
            id="quote-address-line2"
            value={quoteForm.addressLine2}
            onChange={(event) =>
              setQuoteForm((current) => ({
                ...current,
                addressLine2: event.target.value,
              }))
            }
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-100 outline-none ring-amber-500 transition focus:ring-2"
            placeholder="Unit 4B"
            autoComplete="address-line2"
            disabled={quoteSubmitting || profileLoading}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <label
              htmlFor="quote-city"
              className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-slate-400"
            >
              City
            </label>
            <input
              id="quote-city"
              value={quoteForm.city}
              onChange={(event) =>
                setQuoteForm((current) => ({
                  ...current,
                  city: event.target.value,
                }))
              }
              required
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-100 outline-none ring-amber-500 transition focus:ring-2"
              placeholder="Austin"
              autoComplete="address-level2"
              disabled={quoteSubmitting || profileLoading}
            />
          </div>
          <div>
            <label
              htmlFor="quote-state"
              className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-slate-400"
            >
              State
            </label>
            <input
              id="quote-state"
              value={quoteForm.state}
              onChange={(event) =>
                setQuoteForm((current) => ({
                  ...current,
                  state: event.target.value,
                }))
              }
              required
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-100 outline-none ring-amber-500 transition focus:ring-2"
              placeholder="TX"
              autoComplete="address-level1"
              disabled={quoteSubmitting || profileLoading}
            />
          </div>
          <div>
            <label
              htmlFor="quote-postal"
              className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-slate-400"
            >
              Postal code
            </label>
            <input
              id="quote-postal"
              value={quoteForm.postalCode}
              onChange={(event) =>
                setQuoteForm((current) => ({
                  ...current,
                  postalCode: event.target.value,
                }))
              }
              required
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-100 outline-none ring-amber-500 transition focus:ring-2"
              placeholder="73301"
              autoComplete="postal-code"
              disabled={quoteSubmitting || profileLoading}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="quote-notes"
            className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-slate-400"
          >
            Notes
          </label>
          <textarea
            id="quote-notes"
            value={quoteForm.notes}
            onChange={(event) =>
              setQuoteForm((current) => ({
                ...current,
                notes: event.target.value,
              }))
            }
            rows={5}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-100 outline-none ring-amber-500 transition focus:ring-2"
            placeholder="Tell us about the space, style, and timeline."
            disabled={quoteSubmitting}
          />
          <p className="mt-2 text-[0.65rem] text-slate-500">
            We&apos;ll link the photos you selected above and follow up with any
            clarifying questions.
          </p>
        </div>

        <button
          type="button"
          className="w-full rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-amber-500/60"
          onClick={() => void submitQuote()}
          disabled={quoteSubmitting}
        >
          {quoteSubmitting ? "Submitting…" : "Submit quote request"}
        </button>

        {(quoteError || quoteMessage) && (
          <p
            className={`rounded-2xl border px-4 py-3 text-sm ${
              quoteError
                ? "border-red-500/60 bg-red-500/10 text-red-100"
                : "border-emerald-500/60 bg-emerald-500/10 text-emerald-100"
            }`}
          >
            {quoteError ?? quoteMessage}
          </p>
        )}
      </div>
    </section>
  );

  const historyTab = (
    <section className="space-y-10 rounded-[2.25rem] border border-white/10 bg-slate-950/70 p-8 ring-1 ring-white/10 md:p-10">
      <div className="space-y-3">
        <p className="w-fit rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.4em] text-amber-200">
          Status timeline
        </p>
        <h2 className="text-2xl font-semibold text-slate-50 md:text-[2rem]">
          Review your quote history and invoices.
        </h2>
        <p className="text-sm text-slate-400 md:text-base">
          Everything stays synced with the studio—check here for approvals,
          totals, and payment links.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">
            Quotes
          </h3>
          <button
            type="button"
            onClick={() => void loadQuotes()}
            className="rounded-full border border-white/15 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-300 transition hover:border-amber-300/50 hover:bg-amber-300/10 hover:text-amber-100"
          >
            Refresh
          </button>
        </div>
        {quotesLoading ? (
          <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-sm text-slate-300">
            Loading quotes…
          </p>
        ) : quotesError ? (
          <p className="rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-6 text-sm text-red-100">
            {quotesError}
          </p>
        ) : quotes.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-sm text-slate-300">
            No quotes yet. Submit your first request above.
          </p>
        ) : (
          <ul className="space-y-3">
            {quotes.map((quote) => {
              const total = resolveAmount(
                typeof quote.total_cents === "number"
                  ? quote.total_cents
                  : typeof quote.total_estimate_cents === "number"
                    ? quote.total_estimate_cents
                    : null,
                typeof quote.total === "number" ? quote.total : null,
              );
              return (
                <li
                  key={quote.id}
                  className="rounded-2xl border border-white/10 bg-black/25 px-5 py-4 text-sm text-slate-300"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                        {quote.reference ||
                          quote.title ||
                          `Quote ${quote.id.slice(0, 6)}`}
                      </p>
                      <p className="text-slate-200">
                        {formatTimestamp(
                          quote.created_at ?? quote.updated_at ?? null,
                        )}
                      </p>
                      <p className="text-[0.75rem] text-slate-400">
                        {quote.address_line1 || quote.city
                          ? [
                              quote.address_line1,
                              quote.address_line2,
                              [quote.city, quote.state]
                                .filter((part) => Boolean(part))
                                .join(", "),
                              quote.postal_code,
                            ]
                              .filter((part) => Boolean(part))
                              .join(" · ")
                          : "No address on file"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-200">
                        {quote.status?.toString().toUpperCase() ?? "SUBMITTED"}
                      </p>
                      <p className="text-lg font-semibold text-slate-50">
                        {formatCurrency(total)}
                      </p>
                    </div>
                  </div>
                  {quote.notes && (
                    <p className="mt-3 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-slate-300">
                      {quote.notes}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">
            Invoices
          </h3>
          <button
            type="button"
            onClick={() => void loadInvoices()}
            className="rounded-full border border-white/15 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-300 transition hover:border-emerald-300/50 hover:bg-emerald-300/10 hover:text-emerald-100"
          >
            Refresh
          </button>
        </div>
        {invoicesLoading ? (
          <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-sm text-slate-300">
            Loading invoices…
          </p>
        ) : invoicesError ? (
          <p className="rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-6 text-sm text-red-100">
            {invoicesError}
          </p>
        ) : invoices.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-sm text-slate-300">
            No invoices yet. They&apos;ll appear here once a quote is approved.
          </p>
        ) : (
          <ul className="space-y-3">
            {invoices.map((invoice) => {
              const total = resolveAmount(
                typeof invoice.total_cents === "number"
                  ? invoice.total_cents
                  : null,
                typeof invoice.total === "number" ? invoice.total : null,
              );
              const invoiceUrl = resolveInvoiceUrl(invoice);
              return (
                <li
                  key={invoice.id}
                  className="rounded-2xl border border-white/10 bg-black/25 px-5 py-4 text-sm text-slate-300"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                        Invoice {invoice.id.slice(0, 8)}
                      </p>
                      <p className="text-slate-200">
                        {formatTimestamp(
                          invoice.created_at ?? invoice.due_date ?? null,
                        )}
                      </p>
                      <p className="text-[0.75rem] text-slate-400">
                        {invoice.due_date
                          ? `Due ${formatTimestamp(invoice.due_date)}`
                          : invoice.paid_at
                            ? `Paid ${formatTimestamp(invoice.paid_at)}`
                            : "Awaiting payment"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-200">
                        {invoice.status?.toString().toUpperCase() ?? "OPEN"}
                      </p>
                      <p className="text-lg font-semibold text-slate-50">
                        {formatCurrency(total)}
                      </p>
                    </div>
                  </div>
                  {invoiceUrl && (
                    <Link
                      href={invoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-slate-200 transition hover:border-emerald-300/60 hover:bg-emerald-300/10 hover:text-emerald-100"
                    >
                      View invoice →
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );

  if (!user) {
    return <AuthForm />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-white/10 bg-white/[0.05] px-6 py-5 text-xs uppercase tracking-[0.35em] text-slate-200 md:px-8">
        <div className="space-y-1">
          <p className="text-[0.65rem] font-semibold text-amber-200">
            Signed in as
          </p>
          <p className="text-[0.7rem] text-slate-300">
            {user.email ?? user.user_metadata?.full_name ?? user.id}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-full border border-white/15 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-slate-200 transition hover:border-red-400/50 hover:bg-red-400/10 hover:text-red-200"
        >
          Sign out
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-slate-300">
        <button
          type="button"
          onClick={() => setActiveTab("uploads")}
          className={`${tabButtonClass} ${
            activeTab === "uploads"
              ? "border-amber-300/70 bg-amber-400/15 text-amber-100"
              : "border-white/15 bg-black/10 hover:border-amber-200/40 hover:text-amber-100"
          }`}
        >
          Uploads
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("quote")}
          className={`${tabButtonClass} ${
            activeTab === "quote"
              ? "border-amber-300/70 bg-amber-400/15 text-amber-100"
              : "border-white/15 bg-black/10 hover:border-amber-200/40 hover:text-amber-100"
          }`}
        >
          Get a quote
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`${tabButtonClass} ${
            activeTab === "history"
              ? "border-amber-300/70 bg-amber-400/15 text-amber-100"
              : "border-white/15 bg-black/10 hover:border-amber-200/40 hover:text-amber-100"
          }`}
        >
          History
        </button>
      </div>

      {activeTab === "uploads"
        ? uploadsTab
        : activeTab === "quote"
          ? quoteTab
          : historyTab}
    </div>
  );
}

export function CustomerPortal() {
  return (
    <SupabaseAuthProvider>
      <CustomerPortalContent />
    </SupabaseAuthProvider>
  );
}
