"use client";
/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type GeneratedImage = {
  url: string;
  createdAt: number;
  prompt: string;
};

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [results, setResults] = useState<GeneratedImage[]>([]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const previewLabel = useMemo(() => {
    if (!imageFile) return "Upload a base photo";
    return imageFile.name;
  }, [imageFile]);

  const onBaseImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setImageFile(null);
      setPreviewUrl(null);
      return;
    }

    setImageFile(file);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  };
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!imageFile) {
      setErrorMessage("Please choose a photo of your space to transform.");
      return;
    }

    if (!prompt.trim()) {
      setErrorMessage("Describe how you want the space to look.");
      return;
    }

    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("image", imageFile);

    try {
      setIsLoading(true);
      const response = await fetch("/api/edit", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error ?? "Image edit failed.");
      }

      const payload = (await response.json()) as { image: string };

      if (!payload?.image) {
        throw new Error("The AI service returned an unexpected response.");
      }

      setResults((history) => [
        {
          url: payload.image,
          createdAt: Date.now(),
          prompt,
        },
        ...history,
      ]);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while editing the photo.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="font-sans min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 pb-16 pt-12 md:px-12">
        <section className="space-y-4">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">
            Home Stylist
          </p>
          <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
            Transform your room with AI-powered makeovers
          </h1>
          <p className="max-w-2xl text-base text-slate-300 md:text-lg">
            Upload a photo of your space, describe the style you&apos;re aiming
            for, and receive a refreshed design concept in seconds. Try prompts
            like &ldquo;Rustic cabin with warm lighting&rdquo;, &ldquo;Scandinavian
            minimalism&rdquo;, or &ldquo;Neo-industrial loft&rdquo;.
          </p>
        </section>

        <form
          onSubmit={onSubmit}
          className="grid gap-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-amber-500/20 backdrop-blur-md md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:p-8"
        >
          <div className="space-y-6">
            <label className="flex h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-amber-500/70 bg-black/30 text-center text-sm transition hover:bg-black/20">
              <input
                type="file"
                name="image"
                accept="image/*"
                onChange={onBaseImageChange}
                className="hidden"
              />
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">
                Photo
              </span>
              <span className="max-w-[14rem] text-sm font-medium text-slate-200">
                {previewLabel}
              </span>
              <span className="text-xs text-slate-400">
                PNG or JPG up to 8&nbsp;MB
              </span>
            </label>

            {previewUrl && (
              <figure className="space-y-3 rounded-2xl border border-white/10 bg-black/40 p-4">
                <figcaption className="text-sm font-medium text-slate-200">
                  Uploaded photo preview
                </figcaption>
                <img
                  src={previewUrl}
                  alt="Uploaded preview"
                  className="rounded-xl border border-black/40 object-cover"
                />
              </figure>
            )}

          </div>

          <div className="flex flex-col gap-6">
            <div className="space-y-3">
              <label
                htmlFor="prompt"
                className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400"
              >
                Style prompt
              </label>
              <textarea
                id="prompt"
                placeholder="Describe the atmosphere, materials, palette, or mood you’d like to see."
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="min-h-[12rem] w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-slate-200 outline-none ring-amber-500 transition focus:ring-2"
              />
            </div>

            <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/40 p-4 text-xs text-slate-300">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Prompt ideas
              </p>
              <ul className="grid gap-2 text-sm text-slate-300">
                <li>
                  “Rustic cabin aesthetic with reclaimed wood beams, copper
                  fixtures, and warm candle lighting.”
                </li>
                <li>
                  “Bohemian lounge with layered textiles, hanging plants, and
                  low ambient lights.”
                </li>
                <li>
                  “Minimalist Japanese living room, tatami flooring, and soft
                  natural light.”
                </li>
              </ul>
            </div>

            {errorMessage && (
              <p className="rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-amber-500/60"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                  Styling in progress…
                </span>
              ) : (
                "Generate makeover"
              )}
            </button>
          </div>
        </form>

        {results.length > 0 && (
          <section className="space-y-5">
            <div>
              <h2 className="text-2xl font-semibold text-slate-100">
                Recent makeovers
              </h2>
              <p className="text-sm text-slate-400">
                Each preview is generated from the prompt you provided above.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {results.map((result) => (
                <article
                  key={result.createdAt}
                  className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4"
                >
                  <img
                    src={result.url}
                    alt={`Generated makeover for ${result.prompt}`}
                    className="aspect-square w-full rounded-2xl border border-black/30 object-cover shadow-2xl"
                  />
                  <div className="space-y-1 text-sm text-slate-300">
                    <p className="font-medium text-slate-100">{result.prompt}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(result.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
