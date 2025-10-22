"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

const API_ROUTE = "/api/request";

type SubmissionState = "idle" | "sending" | "success" | "error";

type SubmissionMessage = {
  state: SubmissionState;
  text: string;
};

const initialMessage: SubmissionMessage = {
  state: "idle",
  text: "",
};

const inputClassName =
  "mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-100 outline-none ring-amber-500 transition focus:ring-2";

export default function RequestQuotePage() {
  const [message, setMessage] = useState<SubmissionMessage>(initialMessage);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    const formData = new FormData(form);
    const trimmed = {
      name: String(formData.get("name") ?? "").trim(),
      customerName: String(formData.get("customerName") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
    };

    if (!trimmed.name || !trimmed.customerName || !trimmed.email) {
      setMessage({
        state: "error",
        text: "Name, contact name, and email are required.",
      });
      return;
    }

    const payload = {
      name: trimmed.name,
      customerName: trimmed.customerName,
      email: trimmed.email,
      ...(trimmed.phone ? { phone: trimmed.phone } : {}),
      ...(trimmed.description ? { description: trimmed.description } : {}),
    };

    setMessage({ state: "sending", text: "Sending your request..." });

    try {
      const response = await fetch(API_ROUTE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const rawBody = await response.text();
      let parsedBody: unknown = null;

      if (rawBody) {
        try {
          parsedBody = JSON.parse(rawBody);
        } catch (parseError) {
          console.warn("Unable to parse response body", parseError);
        }
      }

      if (!response.ok) {
        const messageFromBody =
          parsedBody &&
          typeof parsedBody === "object" &&
          "message" in parsedBody &&
          typeof parsedBody.message === "string"
            ? parsedBody.message
            : rawBody.trim();

        const errorMessage =
          messageFromBody && messageFromBody.length > 0
            ? messageFromBody
            : `Request failed with status ${response.status}`;
        throw new Error(errorMessage);
      }

      const successMessage =
        parsedBody &&
        typeof parsedBody === "object" &&
        "message" in parsedBody &&
        typeof parsedBody.message === "string"
          ? parsedBody.message
          : "Request sent! We'll be in touch soon.";

      setMessage({
        state: "success",
        text: successMessage,
      });
      form.reset();
    } catch (error) {
      console.error("Failed to submit request", error);
      setMessage({
        state: "error",
        text:
          error instanceof Error && error.message
            ? error.message
            : "Something went wrong while sending your request. Please try again in a moment.",
      });
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(56,189,248,0.1),_transparent_60%)]" />
      <div className="pointer-events-none absolute -top-52 right-24 -z-10 h-[22rem] w-[22rem] rounded-full bg-amber-400/20 blur-[150px]" />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-20 md:px-10">
        <section className="space-y-8 rounded-[2.25rem] border border-white/10 bg-slate-950/70 p-10 ring-1 ring-white/10 md:p-12">
          <div className="space-y-4">
            <p className="w-fit rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.45em] text-amber-200">
              Project requests
            </p>
            <h1 className="text-3xl font-semibold text-slate-50 md:text-4xl">
              Route a makeover brief straight to the studio team.
            </h1>
            <p className="text-sm text-slate-300 md:text-base">
              Capture the essentials—space name, key contacts, and design goals—so we can jump into the
              workspace knowing exactly what success looks like.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="name"
                className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400"
              >
                Project name
              </label>
              <input
                id="name"
                name="name"
                required
                className={inputClassName}
                placeholder="Modern living room refresh"
                autoComplete="organization"
              />
            </div>

            <div>
              <label
                htmlFor="customerName"
                className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400"
              >
                Your name
              </label>
              <input
                id="customerName"
                name="customerName"
                required
                className={inputClassName}
                placeholder="Alex Doe"
                autoComplete="name"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="email"
                  className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className={inputClassName}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
              <div>
                <label
                  htmlFor="phone"
                  className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400"
                >
                  Phone
                </label>
                <input
                  id="phone"
                  name="phone"
                  className={inputClassName}
                  placeholder="(555) 123-4567"
                  autoComplete="tel"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="description"
                className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400"
              >
                Project details
              </label>
              <textarea
                id="description"
                name="description"
                rows={5}
                className={`${inputClassName} min-h-[10rem] resize-none`}
                placeholder="Tell us about the space, style, budgets, and timing."
              />
              <p className="mt-2 text-xs text-slate-500">
                Attach inspiration links or reference images after we reply—we&apos;ll send a secure upload link.
              </p>
            </div>

            <button
              type="submit"
              className="w-full rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-amber-500/60"
              disabled={message.state === "sending"}
            >
              {message.state === "sending" ? "Sending..." : "Submit request"}
            </button>
          </form>

          {message.text && (
            <p
              className={`rounded-2xl border px-4 py-3 text-sm ${
                message.state === "error"
                  ? "border-red-500/60 bg-red-500/10 text-red-100"
                  : message.state === "success"
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-100"
                    : "border-white/15 bg-white/5 text-slate-200"
              }`}
            >
              {message.text}
            </p>
          )}
        </section>

        <section className="mt-10 rounded-[2.25rem] border border-white/10 bg-white/[0.03] p-8 text-sm text-slate-300 ring-1 ring-white/10 md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-200">
                Prefer to explore?
              </p>
              <h2 className="text-2xl font-semibold text-slate-50">
                Jump into the workspace and mock up ideas first.
              </h2>
              <p className="text-xs text-slate-400">
                Upload a space, experiment with prompts, and send us your favourite render with notes.
              </p>
            </div>
            <Link
              href="/workspace"
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-100 transition hover:bg-white/10"
            >
              Launch workspace {"->"}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
