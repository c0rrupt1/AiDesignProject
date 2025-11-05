"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSupabaseAuth } from "@/components/customer/SupabaseAuthProvider";

type AuthMode = "magic" | "signin" | "signup";

const MAIN_SITE_URL =
  process.env.NEXT_PUBLIC_MAIN_SITE_URL?.trim() || "https://deckd.us";

export function StaffAuthForm() {
  const { supabase } = useSupabaseAuth();
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const heading = useMemo(() => {
    switch (authMode) {
      case "magic":
        return "Email yourself a secure link";
      case "signup":
        return "Invite a teammate";
      default:
        return "deckd CRM access";
    }
  }, [authMode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Enter your work email to continue.");
      return;
    }

    try {
      setIsSubmitting(true);
      if (authMode === "magic") {
        const redirectUrl =
          typeof window !== "undefined"
            ? `${window.location.origin}/crm`
            : undefined;
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: trimmedEmail,
          options: {
            emailRedirectTo: redirectUrl,
          },
        });
        if (otpError) {
          throw otpError;
        }
        setStatus(
          "Magic link sent. Open it on this device to continue to the CRM.",
        );
        setPassword("");
        return;
      }

      if (!password.trim()) {
        setError("Enter your password to continue.");
        return;
      }

      if (authMode === "signup") {
        const redirectUrl =
          typeof window !== "undefined"
            ? `${window.location.origin}/crm`
            : undefined;
        const { error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: redirectUrl,
          },
        });
        if (signUpError) {
          throw signUpError;
        }
        setStatus(
          "Account invited. Approve the confirmation email, then mark the profile as staff before signing in.",
        );
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (signInError) {
        throw signInError;
      }
      setStatus(null);
    } catch (error) {
      console.error("Staff auth failed", error);
      setError(
        error instanceof Error && error.message
          ? error.message
          : "We couldn't verify your account. Try again shortly.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 rounded-[2.5rem] border border-white/10 bg-slate-950/80 p-8 ring-1 ring-white/10 md:p-10">
      <div className="space-y-3">
        <p className="w-fit rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.4em] text-sky-200">
          Staff access only
        </p>
        <h1 className="text-3xl font-semibold text-slate-50 md:text-[2.2rem]">
          {heading}
        </h1>
        <p className="text-sm text-slate-400 md:text-base">
          Use your deckd staff credentials to review quotes, customer uploads,
          and invoices. Invite-only — mark new profiles as staff inside Supabase
          before they can sign in here.
        </p>
        <a
          href={MAIN_SITE_URL}
          className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-slate-200 transition hover:border-amber-300/60 hover:bg-amber-300/10 hover:text-amber-100"
        >
          Go to main site →
        </a>
      </div>

      <div className="flex flex-wrap gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-slate-300">
        <button
          type="button"
          onClick={() => setAuthMode("signin")}
          className={`rounded-full border px-3 py-2 transition ${
            authMode === "signin"
              ? "border-sky-300/70 bg-sky-400/10 text-sky-100"
              : "border-white/15 bg-white/0 hover:border-white/25 hover:bg-white/5"
          }`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => setAuthMode("magic")}
          className={`rounded-full border px-3 py-2 transition ${
            authMode === "magic"
              ? "border-sky-300/70 bg-sky-400/10 text-sky-100"
              : "border-white/15 bg-white/0 hover:border-white/25 hover:bg-white/5"
          }`}
        >
          Magic link
        </button>
        <button
          type="button"
          onClick={() => setAuthMode("signup")}
          className={`rounded-full border px-3 py-2 transition ${
            authMode === "signup"
              ? "border-sky-300/70 bg-sky-400/10 text-sky-100"
              : "border-white/15 bg-white/0 hover:border-white/25 hover:bg-white/5"
          }`}
        >
          Invite teammate
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="staff-auth-email"
            className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-slate-400"
          >
            Work email
          </label>
          <input
            id="staff-auth-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-100 outline-none ring-sky-500 transition focus:ring-2"
            placeholder="you@deckd.us"
            autoComplete="email"
            disabled={isSubmitting}
          />
        </div>

        {authMode !== "magic" && (
          <div>
            <label
              htmlFor="staff-auth-password"
              className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-slate-400"
            >
              Password
            </label>
            <input
              id="staff-auth-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-100 outline-none ring-sky-500 transition focus:ring-2"
              placeholder="••••••••"
              autoComplete={
                authMode === "signup" ? "new-password" : "current-password"
              }
              disabled={isSubmitting}
            />
            <p className="mt-2 text-[0.65rem] text-slate-500">
              Passwords need at least 6 characters. You can switch to a magic
              link if you prefer one-time access.
            </p>
          </div>
        )}

        <button
          type="submit"
          className="w-full rounded-full bg-sky-500 px-6 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-sky-500/60"
          disabled={isSubmitting}
        >
          {authMode === "magic"
            ? isSubmitting
              ? "Sending link..."
              : "Send magic link"
            : isSubmitting
              ? authMode === "signup"
                ? "Inviting..."
                : "Signing in..."
              : authMode === "signup"
                ? "Invite teammate"
                : "Sign in"}
        </button>
      </form>

      {(error || status) && (
        <p
          className={`rounded-2xl border px-4 py-3 text-sm ${
            error
              ? "border-red-500/60 bg-red-500/10 text-red-100"
              : "border-emerald-500/60 bg-emerald-500/10 text-emerald-100"
          }`}
        >
          {error ?? status}
        </p>
      )}
    </div>
  );
}
