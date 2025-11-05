"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSupabaseAuth } from "./SupabaseAuthProvider";

type AuthMode = "magic" | "signin" | "signup";

export function AuthForm() {
  const { supabase } = useSupabaseAuth();
  const [authMode, setAuthMode] = useState<AuthMode>("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const heading = useMemo(() => {
    switch (authMode) {
      case "magic":
        return "Access your deckd projects";
      case "signin":
        return "Sign in with your password";
      case "signup":
        return "Create your deckd account";
      default:
        return "Welcome back";
    }
  }, [authMode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Enter your email address to continue.");
      return;
    }

    try {
      setIsSubmitting(true);
      if (authMode === "magic") {
        const redirectUrl =
          typeof window !== "undefined"
            ? `${window.location.origin}/customer`
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
          "Check your inbox for a magic link to open your customer portal.",
        );
        setPassword("");
        return;
      }

      if (!password.trim()) {
        setError("Enter your password to continue.");
        return;
      }

      if (authMode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo:
              typeof window !== "undefined"
                ? `${window.location.origin}/customer`
                : undefined,
          },
        });
        if (signUpError) {
          throw signUpError;
        }
        setStatus(
          "Account created. If confirmation is required, click the link in your email. You can sign in once confirmed.",
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
      console.error("Auth action failed", error);
      setError(
        error instanceof Error && error.message
          ? error.message
          : "We couldn't process your request right now. Try again shortly.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 rounded-[2rem] border border-white/10 bg-slate-950/80 p-8 ring-1 ring-white/10 md:p-10">
      <div className="space-y-3">
        <p className="w-fit rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.4em] text-amber-200">
          Customer Portal
        </p>
        <h1 className="text-3xl font-semibold text-slate-50 md:text-[2.2rem]">
          {heading}
        </h1>
        <p className="text-sm text-slate-400 md:text-base">
          Sign in to manage reference uploads, request quotes, and review your
          invoices in one place.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-slate-300">
        <button
          type="button"
          onClick={() => setAuthMode("magic")}
          className={`rounded-full border px-3 py-2 transition ${
            authMode === "magic"
              ? "border-amber-300/70 bg-amber-400/10 text-amber-100"
              : "border-white/15 bg-white/0 hover:border-white/25 hover:bg-white/5"
          }`}
        >
          Magic link
        </button>
        <button
          type="button"
          onClick={() => setAuthMode("signin")}
          className={`rounded-full border px-3 py-2 transition ${
            authMode === "signin"
              ? "border-amber-300/70 bg-amber-400/10 text-amber-100"
              : "border-white/15 bg-white/0 hover:border-white/25 hover:bg-white/5"
          }`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => setAuthMode("signup")}
          className={`rounded-full border px-3 py-2 transition ${
            authMode === "signup"
              ? "border-amber-300/70 bg-amber-400/10 text-amber-100"
              : "border-white/15 bg-white/0 hover:border-white/25 hover:bg-white/5"
          }`}
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="customer-auth-email"
            className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-slate-400"
          >
            Email address
          </label>
          <input
            id="customer-auth-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-100 outline-none ring-amber-500 transition focus:ring-2"
            placeholder="you@company.com"
            autoComplete="email"
            disabled={isSubmitting}
          />
        </div>

        {authMode !== "magic" && (
          <div>
            <label
              htmlFor="customer-auth-password"
              className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-slate-400"
            >
              Password
            </label>
            <input
              id="customer-auth-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-100 outline-none ring-amber-500 transition focus:ring-2"
              placeholder="••••••••"
              autoComplete={
                authMode === "signup" ? "new-password" : "current-password"
              }
              disabled={isSubmitting}
            />
            <p className="mt-2 text-[0.65rem] text-slate-500">
              Passwords need at least 6 characters. Use a secure phrase if
              you prefer signing in without email links.
            </p>
          </div>
        )}

        <button
          type="submit"
          className="w-full rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-amber-500/60"
          disabled={isSubmitting}
        >
          {authMode === "magic"
            ? isSubmitting
              ? "Sending link..."
              : "Send magic link"
            : isSubmitting
              ? authMode === "signup"
                ? "Creating..."
                : "Signing in..."
              : authMode === "signup"
                ? "Create account"
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
