"use client";

import { FormEvent, useState } from "react";

const WEBHOOK_URL =
  "https://deckd.app.n8n.cloud/webhook/04a63e4d-c10e-48c0-ba40-a37d8a7688ac";

type SubmissionState = "idle" | "sending" | "success" | "error";

type SubmissionMessage = {
  state: SubmissionState;
  text: string;
};

const initialMessage: SubmissionMessage = {
  state: "idle",
  text: "",
};

export default function RequestQuotePage() {
  const [message, setMessage] = useState<SubmissionMessage>(initialMessage);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      customerName: String(formData.get("customerName") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
    };

    setMessage({ state: "sending", text: "Sending your request..." });

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`);
      }

      setMessage({
        state: "success",
        text: "Request sent! We'll be in touch soon.",
      });
      form.reset();
    } catch (error) {
      console.error("Failed to submit request", error);
      setMessage({
        state: "error",
        text:
          "Something went wrong while sending your request. Please try again in a moment.",
      });
    }
  }

  return (
    <main className="min-h-screen bg-neutral-100 py-16">
      <section className="mx-auto max-w-xl rounded-lg bg-white p-8 shadow-lg">
        <h1 className="text-3xl font-semibold text-neutral-900">
          Request a Project Quote
        </h1>
        <p className="mt-2 text-neutral-600">
          Share a few details about your project and we&apos;ll route it directly
          to our workspace.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-neutral-700"
            >
              Project name
            </label>
            <input
              id="name"
              name="name"
              required
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 shadow-sm focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-200"
              placeholder="Modern living room refresh"
            />
          </div>

          <div>
            <label
              htmlFor="customerName"
              className="block text-sm font-medium text-neutral-700"
            >
              Your name
            </label>
            <input
              id="customerName"
              name="customerName"
              required
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 shadow-sm focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-200"
              placeholder="Alex Doe"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-neutral-700"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 shadow-sm focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-200"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-neutral-700"
            >
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 shadow-sm focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-200"
              placeholder="(555) 123-4567"
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-neutral-700"
            >
              Project details
            </label>
            <textarea
              id="description"
              name="description"
              rows={5}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 shadow-sm focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-200"
              placeholder="Tell us about the space, style, and goals."
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-neutral-900 px-4 py-2 text-white transition hover:bg-neutral-800"
            disabled={message.state === "sending"}
          >
            {message.state === "sending" ? "Sending..." : "Submit"}
          </button>
        </form>

        {message.text && (
          <p
            className={`mt-4 text-sm ${
              message.state === "error"
                ? "text-red-600"
                : message.state === "success"
                  ? "text-green-600"
                  : "text-neutral-600"
            }`}
          >
            {message.text}
          </p>
        )}
      </section>
    </main>
  );
}
